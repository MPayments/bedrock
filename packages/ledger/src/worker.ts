import { sql } from "drizzle-orm";
import { Transaction, type Database } from "@bedrock/db";
import {
    schema
} from "@bedrock/db/schema";

import type { TbClient } from "./tb";
import { makeTbTransfer, tbCreateTransfersOrThrow, TransferFlags, TB_AMOUNT_MAX } from "./tb";
import { resolveTbAccountId } from "./resolve";
import { PostingError, isRetryableError } from "./errors";
import { PlanType } from "./types";
import { LRUCache } from "lru-cache";

const DEFAULT_ACCOUNT_CACHE_MAX = 10_000;

export function createLedgerWorker(deps: { db: Database; tb: TbClient; accountCacheMaxSize?: number }) {
    const { db, tb } = deps;
    const workerAccountCache = new LRUCache<string, bigint>({
        max: Math.max(1, Math.floor(deps.accountCacheMaxSize ?? DEFAULT_ACCOUNT_CACHE_MAX))
    });
    const workerAccountInflight = new Map<string, Promise<bigint>>();

    function accountCacheKey(orgId: string, key: string, tbLedger: number) {
        return `${orgId}|${tbLedger}|${key}`;
    }

    async function resolveAccount(orgId: string, key: string, currency: string, tbLedger: number): Promise<bigint> {
        const cacheKey = accountCacheKey(orgId, key, tbLedger);
        const cached = workerAccountCache.get(cacheKey);
        if (cached !== undefined) return cached;

        const inflight = workerAccountInflight.get(cacheKey);
        if (inflight) return inflight;

        const promise = (async () => {
            const id = await resolveTbAccountId({ db, tb, orgId, key, currency, tbLedger });
            workerAccountCache.set(cacheKey, id);
            return id;
        })();

        workerAccountInflight.set(cacheKey, promise);
        try {
            return await promise;
        } finally {
            workerAccountInflight.delete(cacheKey);
        }
    }

    async function processOnce(opts?: {
        batchSize?: number;
        maxAttempts?: number;
        leaseSeconds?: number;
    }) {
        const batchSize = opts?.batchSize ?? 50;
        const maxAttempts = opts?.maxAttempts ?? 25;
        const leaseSeconds = opts?.leaseSeconds ?? 600;

        const claimed = await db.execute(sql`
      WITH c AS (
        SELECT id
        FROM ${schema.outbox}
        WHERE kind = 'post_journal'
          AND attempts < ${maxAttempts}
          AND (
            (status = 'pending' AND available_at <= now())
            OR
            (status = 'processing' AND locked_at IS NOT NULL AND locked_at <= now() - (${leaseSeconds} || ' seconds')::interval)
          )
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      UPDATE ${schema.outbox} o
        SET status = 'processing',
            locked_at = now(),
            attempts = attempts + 1,
            error = NULL
      FROM c
      WHERE o.id = c.id
      RETURNING o.id as outbox_id, o.org_id, o.ref_id as journal_entry_id, o.attempts as attempts
    `);

        const jobs = (claimed.rows ?? []) as Array<{
            outbox_id: string;
            org_id: string;
            journal_entry_id: string;
            attempts: number;
        }>;

        for (const job of jobs) {
            try {
                await postJournal(job.org_id, job.journal_entry_id);

                // Wrap success updates in transaction to ensure atomicity
                await db.transaction(async (tx: Transaction) => {
                    await tx.execute(sql`
            UPDATE ${schema.outbox}
            SET status = 'done', locked_at = NULL, error = NULL
            WHERE id = ${job.outbox_id}
          `);

                    await tx.execute(sql`
            UPDATE ${schema.journalEntries}
            SET outbox_attempts = ${job.attempts},
                last_outbox_error_at = NULL,
                error = NULL
            WHERE id = ${job.journal_entry_id} AND status = 'pending'
          `);
                });
            } catch (e: any) {
                const msg = String(e?.message ?? e);
                const retryable = isRetryableError(e);

                // Wrap error handling updates in transaction to ensure atomicity
                await db.transaction(async (tx: Transaction) => {
                    // Fail immediately for permanent errors, or when max attempts reached
                    if (!retryable || job.attempts >= maxAttempts) {
                        const errorMsg = !retryable
                            ? `[PERMANENT ERROR] ${msg}`
                            : `[MAX RETRIES EXCEEDED] ${msg}`;

                        await tx.execute(sql`
              UPDATE ${schema.outbox}
              SET status = 'failed', locked_at = NULL, error = ${errorMsg}
              WHERE id = ${job.outbox_id}
            `);

                        await tx.execute(sql`
              UPDATE ${schema.tbTransferPlans}
              SET status = 'failed', error = ${errorMsg}
              WHERE journal_entry_id = ${job.journal_entry_id}
                AND org_id = ${job.org_id}
                AND status <> 'posted'
            `);

                        await tx.execute(sql`
              UPDATE ${schema.journalEntries}
              SET status = 'failed',
                  error = ${errorMsg},
                  outbox_attempts = ${job.attempts},
                  last_outbox_error_at = now()
              WHERE id = ${job.journal_entry_id}
            `);
                    } else {
                        await tx.execute(sql`
              UPDATE ${schema.outbox}
              SET status = 'pending',
                  locked_at = NULL,
                  error = ${msg},
                  available_at = now() + (LEAST(1800, POWER(2, attempts)) || ' seconds')::interval
              WHERE id = ${job.outbox_id}
            `);

                        await tx.execute(sql`
              UPDATE ${schema.journalEntries}
              SET error = ${msg},
                  outbox_attempts = ${job.attempts},
                  last_outbox_error_at = now()
              WHERE id = ${job.journal_entry_id} AND status = 'pending'
            `);
                    }
                });
            }
        }

        return jobs.length;
    }

    async function postJournal(orgId: string, journalEntryId: string) {
        const plans = await db
            .select()
            .from(schema.tbTransferPlans)
            .where(sql`${schema.tbTransferPlans.journalEntryId} = ${journalEntryId} AND ${schema.tbTransferPlans.orgId} = ${orgId}`)
            .orderBy(schema.tbTransferPlans.idx);

        const transfers = [];
        for (const pl of plans) {
            if (pl.status === "posted") continue;

            if (pl.type === PlanType.CREATE) {
                if (!pl.debitKey || !pl.creditKey) throw new PostingError("create plan requires debitKey/creditKey");

                let flags = 0;
                if (pl.isLinked) flags |= TransferFlags.linked;
                if (pl.isPending) flags |= TransferFlags.pending;

                const debitId = await resolveAccount(orgId, pl.debitKey, pl.currency, pl.tbLedger);
                const creditId = await resolveAccount(orgId, pl.creditKey, pl.currency, pl.tbLedger);

                transfers.push(
                    makeTbTransfer({
                        id: pl.transferId,
                        debitAccountId: debitId,
                        creditAccountId: creditId,
                        amount: pl.amount,
                        tbLedger: pl.tbLedger,
                        code: pl.code,
                        flags,
                        pendingId: 0n,
                        timeoutSeconds: pl.isPending ? pl.timeoutSeconds : 0
                    })
                );
                continue;
            }

            if (!pl.pendingId) throw new PostingError(`${pl.type} plan requires pendingId`);

            let flags = 0;
            if (pl.isLinked) flags |= TransferFlags.linked;

            if (pl.type === PlanType.POST_PENDING) {
                flags |= TransferFlags.post_pending_transfer;

                const amountForTb = pl.amount === 0n ? TB_AMOUNT_MAX : pl.amount;

                transfers.push(
                    makeTbTransfer({
                        id: pl.transferId,
                        debitAccountId: 0n,
                        creditAccountId: 0n,
                        amount: amountForTb,
                        tbLedger: 0,
                        code: pl.code ?? 0,
                        flags,
                        pendingId: pl.pendingId
                    })
                );
                continue;
            }

            flags |= TransferFlags.void_pending_transfer;

            transfers.push(
                makeTbTransfer({
                    id: pl.transferId,
                    debitAccountId: 0n,
                    creditAccountId: 0n,
                    amount: 0n,
                    tbLedger: 0,
                    code: pl.code ?? 0,
                    flags,
                    pendingId: pl.pendingId
                })
            );
        }

        if (transfers.length) {
            await tbCreateTransfersOrThrow(tb, transfers);
        }

        // Wrap both updates in a transaction to ensure atomicity
        // If TigerBeetle transfers succeeded but DB update fails, the next retry
        // will skip already-posted plans and update the status correctly
        await db.transaction(async (tx: Transaction) => {
            await tx.execute(sql`
          UPDATE ${schema.tbTransferPlans}
          SET status = 'posted', error = NULL
          WHERE journal_entry_id = ${journalEntryId} 
            AND org_id = ${orgId}
            AND status <> 'posted'
        `);

            await tx.execute(sql`
          UPDATE ${schema.journalEntries}
          SET status = 'posted', posted_at = now(), error = NULL, last_outbox_error_at = NULL
          WHERE id = ${journalEntryId}
            AND status <> 'posted'
        `);
        });
    }

    return {
        processOnce,
    };
}
