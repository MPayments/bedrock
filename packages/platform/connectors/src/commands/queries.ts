import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { schema } from "@bedrock/connectors/schema";

import type { ConnectorsServiceContext } from "../internal/context";
import {
  ClaimDispatchBatchInputSchema,
  ClaimPollBatchInputSchema,
  ClaimStatementBatchInputSchema,
} from "../validation";

export function createQueryHandlers(context: ConnectorsServiceContext) {
  const { db } = context;

  async function getIntentById(intentId: string) {
    const [intent] = await db
      .select()
      .from(schema.connectorPaymentIntents)
      .where(eq(schema.connectorPaymentIntents.id, intentId))
      .limit(1);

    return intent ?? null;
  }

  async function getIntentByDocumentId(documentId: string) {
    const [intent] = await db
      .select()
      .from(schema.connectorPaymentIntents)
      .where(eq(schema.connectorPaymentIntents.documentId, documentId))
      .limit(1);

    return intent ?? null;
  }

  async function getAttemptById(attemptId: string) {
    const [attempt] = await db
      .select()
      .from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.id, attemptId))
      .limit(1);

    return attempt ?? null;
  }

  async function listIntents(input?: {
    status?: string;
    direction?: "payin" | "payout";
    limit?: number;
    offset?: number;
  }) {
    return db
      .select()
      .from(schema.connectorPaymentIntents)
      .where(
        and(
          input?.status
            ? eq(schema.connectorPaymentIntents.status, input.status as never)
            : undefined,
          input?.direction
            ? eq(schema.connectorPaymentIntents.direction, input.direction)
            : undefined,
        ),
      )
      .orderBy(desc(schema.connectorPaymentIntents.createdAt))
      .limit(input?.limit ?? 50)
      .offset(input?.offset ?? 0);
  }

  async function listAttempts(input?: {
    intentId?: string;
    status?: string;
    providerCode?: string;
    limit?: number;
    offset?: number;
  }) {
    return db
      .select()
      .from(schema.paymentAttempts)
      .where(
        and(
          input?.intentId
            ? eq(schema.paymentAttempts.intentId, input.intentId)
            : undefined,
          input?.status
            ? eq(schema.paymentAttempts.status, input.status as never)
            : undefined,
          input?.providerCode
            ? eq(schema.paymentAttempts.providerCode, input.providerCode)
            : undefined,
        ),
      )
      .orderBy(desc(schema.paymentAttempts.createdAt))
      .limit(input?.limit ?? 100)
      .offset(input?.offset ?? 0);
  }

  async function listEvents(input?: {
    providerCode?: string;
    intentId?: string;
    attemptId?: string;
    limit?: number;
    offset?: number;
  }) {
    return db
      .select()
      .from(schema.connectorEvents)
      .where(
        and(
          input?.providerCode
            ? eq(schema.connectorEvents.providerCode, input.providerCode)
            : undefined,
          input?.intentId
            ? eq(schema.connectorEvents.intentId, input.intentId)
            : undefined,
          input?.attemptId
            ? eq(schema.connectorEvents.attemptId, input.attemptId)
            : undefined,
        ),
      )
      .orderBy(desc(schema.connectorEvents.receivedAt))
      .limit(input?.limit ?? 100)
      .offset(input?.offset ?? 0);
  }

  async function upsertProviderHealth(input: {
    providerCode: string;
    status: "up" | "degraded" | "down";
    score: number;
    error?: string | null;
    successDelta?: number;
    failureDelta?: number;
  }) {
    const successDelta = input.successDelta ?? 0;
    const failureDelta = input.failureDelta ?? 0;

    const [row] = await db
      .insert(schema.connectorHealth)
      .values({
        providerCode: input.providerCode,
        status: input.status,
        score: input.score,
        successCount: Math.max(0, successDelta),
        failureCount: Math.max(0, failureDelta),
        lastCheckedAt: new Date(),
        lastSuccessAt: successDelta > 0 ? new Date() : null,
        lastFailureAt: failureDelta > 0 ? new Date() : null,
        lastError: input.error ?? null,
      })
      .onConflictDoUpdate({
        target: schema.connectorHealth.providerCode,
        set: {
          status: input.status,
          score: input.score,
          successCount: sql`${schema.connectorHealth.successCount} + ${Math.max(0, successDelta)}`,
          failureCount: sql`${schema.connectorHealth.failureCount} + ${Math.max(0, failureDelta)}`,
          lastCheckedAt: sql`now()`,
          lastSuccessAt:
            successDelta > 0
              ? sql`now()`
              : schema.connectorHealth.lastSuccessAt,
          lastFailureAt:
            failureDelta > 0
              ? sql`now()`
              : schema.connectorHealth.lastFailureAt,
          lastError: input.error ?? null,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return row!;
  }

  async function listProviderHealth() {
    return db
      .select()
      .from(schema.connectorHealth)
      .orderBy(schema.connectorHealth.providerCode);
  }

  async function claimDispatchBatch(input?: {
    batchSize?: number;
    now?: Date;
  }) {
    const validated = ClaimDispatchBatchInputSchema.parse(input ?? {});
    const now = validated.now ?? new Date();

    const ATTEMPT_EXPIRY_HOURS = 24;
    const expiryThreshold = new Date(now.getTime() - ATTEMPT_EXPIRY_HOURS * 3600_000);

    return db.transaction(async (tx) => {
      const rows = await tx
        .select({
          attemptId: schema.paymentAttempts.id,
        })
        .from(schema.paymentAttempts)
        .where(
          and(
            inArray(schema.paymentAttempts.status, [
              "queued",
              "failed_retryable",
            ]),
            or(
              isNull(schema.paymentAttempts.nextRetryAt),
              lte(schema.paymentAttempts.nextRetryAt, now),
            ),
            gte(schema.paymentAttempts.createdAt, expiryThreshold),
          ),
        )
        .orderBy(schema.paymentAttempts.createdAt)
        .for("update", { skipLocked: true })
        .limit(validated.batchSize);

      if (rows.length === 0) {
        return [];
      }

      const attemptIds = rows.map((row) => row.attemptId);
      await tx
        .update(schema.paymentAttempts)
        .set({
          status: "dispatching",
          dispatchedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(inArray(schema.paymentAttempts.id, attemptIds));

      return tx
        .select({
          attempt: schema.paymentAttempts,
          intent: schema.connectorPaymentIntents,
        })
        .from(schema.paymentAttempts)
        .innerJoin(
          schema.connectorPaymentIntents,
          eq(
            schema.connectorPaymentIntents.id,
            schema.paymentAttempts.intentId,
          ),
        )
        .where(inArray(schema.paymentAttempts.id, attemptIds))
        .orderBy(schema.paymentAttempts.attemptNo);
    });
  }

  async function claimPollBatch(input?: {
    batchSize?: number;
    workerId?: string;
    leaseSec?: number;
    now?: Date;
  }) {
    const validated = ClaimPollBatchInputSchema.parse(input ?? {});
    const now = validated.now ?? new Date();
    const claimUntil = new Date(now.getTime() + validated.leaseSec * 1000);
    const claimToken = `${validated.workerId}:${now.toISOString()}`;

    return db.transaction(async (tx) => {
      const rows = await tx
        .select({
          attemptId: schema.paymentAttempts.id,
        })
        .from(schema.paymentAttempts)
        .where(
          and(
            inArray(schema.paymentAttempts.status, ["submitted", "pending"]),
            or(
              isNull(schema.paymentAttempts.claimUntil),
              lte(schema.paymentAttempts.claimUntil, now),
            ),
          ),
        )
        .orderBy(schema.paymentAttempts.updatedAt, schema.paymentAttempts.id)
        .for("update", { skipLocked: true })
        .limit(validated.batchSize);

      if (rows.length === 0) {
        return [];
      }

      const attemptIds = rows.map((row) => row.attemptId);
      await tx
        .update(schema.paymentAttempts)
        .set({
          claimToken,
          claimUntil,
          updatedAt: sql`now()`,
        })
        .where(inArray(schema.paymentAttempts.id, attemptIds));

      return tx
        .select({
          attempt: schema.paymentAttempts,
          intent: schema.connectorPaymentIntents,
        })
        .from(schema.paymentAttempts)
        .innerJoin(
          schema.connectorPaymentIntents,
          eq(schema.connectorPaymentIntents.id, schema.paymentAttempts.intentId),
        )
        .where(inArray(schema.paymentAttempts.id, attemptIds))
        .orderBy(schema.paymentAttempts.updatedAt, schema.paymentAttempts.id);
    });
  }

  async function claimStatementProviders(input?: {
    batchSize?: number;
    workerId?: string;
    leaseSec?: number;
    now?: Date;
  }) {
    const validated = ClaimStatementBatchInputSchema.parse(input ?? {});
    const now = validated.now ?? new Date();
    const claimUntil = new Date(now.getTime() + validated.leaseSec * 1000);
    const claimToken = `${validated.workerId}:${now.toISOString()}`;

    return db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(schema.connectorCursors)
        .where(
          or(
            isNull(schema.connectorCursors.claimUntil),
            lte(schema.connectorCursors.claimUntil, now),
          ),
        )
        .orderBy(
          schema.connectorCursors.updatedAt,
          schema.connectorCursors.providerCode,
          schema.connectorCursors.cursorKey,
        )
        .for("update", { skipLocked: true })
        .limit(validated.batchSize);

      for (const row of rows) {
        await tx
          .update(schema.connectorCursors)
          .set({
            claimToken,
            claimUntil,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(schema.connectorCursors.providerCode, row.providerCode),
              eq(schema.connectorCursors.cursorKey, row.cursorKey),
            ),
          );
      }

      return rows.map((row) => ({
        ...row,
        claimToken,
        claimUntil,
      }));
    });
  }

  return {
    getIntentById,
    getIntentByDocumentId,
    getAttemptById,
    listIntents,
    listAttempts,
    listEvents,
    upsertProviderHealth,
    listProviderHealth,
    claimDispatchBatch,
    claimPollBatch,
    claimStatementProviders,
  };
}
