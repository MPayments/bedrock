import { sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";

import { isRetryableError } from "./errors";
import { makeTbAccount, makeTbTransfer, tbCreateAccountsOrThrow, tbCreateTransfersOrThrow, TransferFlags, TB_AMOUNT_MAX, type TbClient } from "./tb";
import { PlanType } from "./types";

function tbAccountCodeFromId(id: bigint): number {
  return Number(id % 65535n) + 1;
}

export function createLedgerWorker(deps: { db: Database; tb: TbClient }) {
  const { db, tb } = deps;

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

    for (const job of jobs) {
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

    return jobs.length;
  }

  async function postOperation(operationId: string) {
    const plans = await db
      .select()
      .from(schema.tbTransferPlans)
      .where(sql`${schema.tbTransferPlans.operationId} = ${operationId}`)
      .orderBy(schema.tbTransferPlans.lineNo);

    const createPlans = plans.filter(
      (plan) => plan.type === PlanType.CREATE && plan.status !== "posted",
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

      if (plan.type === PlanType.CREATE) {
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

      if (plan.type === PlanType.POST_PENDING) {
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

  return {
    processOnce,
  };
}
