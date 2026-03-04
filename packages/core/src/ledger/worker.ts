import { sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/kernel/db/types";
import { schema } from "@bedrock/core/ledger/schema";

import type { BedrockWorker, WorkerRunContext, WorkerRunResult } from "../worker-runtime";
import { isRetryableError } from "./errors";
import { makeTbAccount, makeTbTransfer, tbCreateAccountsOrThrow, tbCreateTransfersOrThrow, TransferFlags, TB_AMOUNT_MAX, type TbClient } from "./tb";
import { OPERATION_TRANSFER_TYPE } from "./types";

function tbAccountCodeFromId(id: bigint): number {
  return Number(id % 65535n) + 1;
}

export interface LedgerWorkerJobContext {
  outboxId: string;
  operationId: string;
  attempts: number;
  bookIds: string[];
}

type LedgerWorkerJobGuard = (
  input: LedgerWorkerJobContext,
) => Promise<boolean> | boolean;

interface LedgerWorkerDefinitionConfig {
  batchSize?: number;
  maxAttempts?: number;
  leaseSeconds?: number;
}

async function listOperationBookIds(
  db: Database,
  operationIds: string[],
): Promise<Map<string, string[]>> {
  if (operationIds.length === 0) {
    return new Map();
  }

  const result = await db.execute(sql`
    SELECT DISTINCT
      operation_id::text AS operation_id,
      book_id::text AS book_id
    FROM ${schema.postings}
    WHERE operation_id IN (${sql.join(operationIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `);
  const rows = (result.rows ?? []) as {
    operation_id: string;
    book_id: string;
  }[];

  const byOperation = new Map<string, Set<string>>();
  for (const row of rows) {
    const bucket = byOperation.get(row.operation_id) ?? new Set<string>();
    bucket.add(row.book_id);
    byOperation.set(row.operation_id, bucket);
  }

  return new Map(
    [...byOperation.entries()].map(([operationId, bookIds]) => [
      operationId,
      [...bookIds],
    ]),
  );
}

async function releaseClaimedOutboxJob(input: {
  db: Database;
  outboxId: string;
}) {
  await input.db.execute(sql`
    UPDATE ${schema.outbox}
    SET
      status = 'pending',
      locked_at = NULL,
      error = NULL,
      available_at = now()
    WHERE id = ${input.outboxId}
      AND status = 'processing'
  `);
}

export function createLedgerWorkerDefinition(deps: {
  id?: string;
  moduleId?: string;
  intervalMs?: number;
  db: Database;
  tb: TbClient;
  beforeJob?: LedgerWorkerJobGuard;
} & LedgerWorkerDefinitionConfig): BedrockWorker {
  const { db, tb } = deps;
  const beforeJob = deps.beforeJob;
  const batchSize = deps.batchSize ?? 50;
  const maxAttempts = deps.maxAttempts ?? 25;
  const leaseSeconds = deps.leaseSeconds ?? 600;

  async function runPass() {
    const claimed = await db.execute(sql`
      WITH c AS (
        SELECT id
        FROM ${schema.outbox}
        WHERE kind = 'post_operation'
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
      RETURNING o.id as outbox_id, o.ref_id as operation_id, o.attempts as attempts
    `);

    const jobs = (claimed.rows ?? []) as {
      outbox_id: string;
      operation_id: string;
      attempts: number;
    }[];

    const operationBookIds = await listOperationBookIds(
      db,
      jobs.map((job) => job.operation_id),
    );
    let processed = 0;

    for (const job of jobs) {
      const bookIds = operationBookIds.get(job.operation_id) ?? [];
      if (beforeJob) {
        const isEnabled = await beforeJob({
          outboxId: job.outbox_id,
          operationId: job.operation_id,
          attempts: job.attempts,
          bookIds,
        });
        if (!isEnabled) {
          await releaseClaimedOutboxJob({
            db,
            outboxId: job.outbox_id,
          });
          continue;
        }
      }

      processed += 1;

      try {
        await postOperation(job.operation_id);

        await db.transaction(async (tx: Transaction) => {
          await tx.execute(sql`
            UPDATE ${schema.outbox}
            SET status = 'done', locked_at = NULL, error = NULL
            WHERE id = ${job.outbox_id}
          `);

          await tx.execute(sql`
            UPDATE ${schema.ledgerOperations}
            SET outbox_attempts = ${job.attempts},
                last_outbox_error_at = NULL,
                error = NULL
            WHERE id = ${job.operation_id} AND status = 'pending'
          `);
        });
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        const retryable = isRetryableError(e);

        await db.transaction(async (tx: Transaction) => {
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
              WHERE operation_id = ${job.operation_id}
                AND status <> 'posted'
            `);

            await tx.execute(sql`
              UPDATE ${schema.ledgerOperations}
              SET status = 'failed',
                  error = ${errorMsg},
                  outbox_attempts = ${job.attempts},
                  last_outbox_error_at = now()
              WHERE id = ${job.operation_id}
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
              UPDATE ${schema.ledgerOperations}
              SET error = ${msg},
                  outbox_attempts = ${job.attempts},
                  last_outbox_error_at = now()
              WHERE id = ${job.operation_id} AND status = 'pending'
            `);
          }
        });
      }
    }

    return processed;
  }

  async function postOperation(operationId: string) {
    const plans = await db
      .select()
      .from(schema.tbTransferPlans)
      .where(sql`${schema.tbTransferPlans.operationId} = ${operationId}`)
      .orderBy(schema.tbTransferPlans.lineNo);

    const createPlans = plans.filter(
      (plan) => plan.type === OPERATION_TRANSFER_TYPE.CREATE && plan.status !== "posted",
    );

    const accountRows = new Map<bigint, { tbLedger: number }>();
    for (const plan of createPlans) {
      if (plan.debitTbAccountId) {
        accountRows.set(plan.debitTbAccountId, { tbLedger: plan.tbLedger });
      }
      if (plan.creditTbAccountId) {
        accountRows.set(plan.creditTbAccountId, { tbLedger: plan.tbLedger });
      }
    }

    if (accountRows.size > 0) {
      await tbCreateAccountsOrThrow(
        tb,
        Array.from(accountRows.entries()).map(([id, meta]) =>
          makeTbAccount(id, meta.tbLedger, tbAccountCodeFromId(id), 0),
        ),
      );
    }

    const transfers = [];

    for (const plan of plans) {
      if (plan.status === "posted") continue;

      if (plan.type === OPERATION_TRANSFER_TYPE.CREATE) {
        if (!plan.debitTbAccountId || !plan.creditTbAccountId) {
          throw new Error("create plan requires debitTbAccountId and creditTbAccountId");
        }

        let flags = 0;
        if (plan.isLinked) flags |= TransferFlags.linked;
        if (plan.isPending) flags |= TransferFlags.pending;

        transfers.push(
          makeTbTransfer({
            id: plan.transferId,
            debitAccountId: plan.debitTbAccountId,
            creditAccountId: plan.creditTbAccountId,
            amount: plan.amount,
            tbLedger: plan.tbLedger,
            code: plan.code,
            flags,
            pendingId: 0n,
            timeoutSeconds: plan.isPending ? plan.timeoutSeconds : 0,
          }),
        );
        continue;
      }

      if (!plan.pendingId) {
        throw new Error(`${plan.type} plan requires pendingId`);
      }

      let flags = 0;
      if (plan.isLinked) flags |= TransferFlags.linked;

      if (plan.type === OPERATION_TRANSFER_TYPE.POST_PENDING) {
        flags |= TransferFlags.post_pending_transfer;

        transfers.push(
          makeTbTransfer({
            id: plan.transferId,
            debitAccountId: 0n,
            creditAccountId: 0n,
            amount: plan.amount === 0n ? TB_AMOUNT_MAX : plan.amount,
            tbLedger: 0,
            code: plan.code ?? 0,
            flags,
            pendingId: plan.pendingId,
          }),
        );
        continue;
      }

      flags |= TransferFlags.void_pending_transfer;

      transfers.push(
        makeTbTransfer({
          id: plan.transferId,
          debitAccountId: 0n,
          creditAccountId: 0n,
          amount: 0n,
          tbLedger: 0,
          code: plan.code ?? 0,
          flags,
          pendingId: plan.pendingId,
        }),
      );
    }

    if (transfers.length > 0) {
      await tbCreateTransfersOrThrow(tb, transfers);
    }

    await db.transaction(async (tx: Transaction) => {
      await tx.execute(sql`
        UPDATE ${schema.tbTransferPlans}
        SET status = 'posted', error = NULL
        WHERE operation_id = ${operationId}
          AND status <> 'posted'
      `);

      await tx.execute(sql`
        UPDATE ${schema.ledgerOperations}
        SET status = 'posted', posted_at = now(), error = NULL, last_outbox_error_at = NULL
        WHERE id = ${operationId}
          AND status <> 'posted'
      `);
    });
  }

  async function runOnce(_ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await runPass();
    return { processed };
  }

  return {
    id: deps.id ?? "ledger",
    moduleId: deps.moduleId ?? "ledger",
    intervalMs: deps.intervalMs ?? 5_000,
    runOnce,
  };
}
