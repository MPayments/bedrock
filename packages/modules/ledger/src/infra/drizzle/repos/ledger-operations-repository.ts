import { eq } from "drizzle-orm";

import type { Transaction } from "@bedrock/platform/persistence";

import type { LedgerOperationsWritePort } from "../../../application/commit/ports";
import { IdempotencyConflictError } from "../../../errors";
import { schema } from "../schema";

export function createDrizzleLedgerOperationsRepository(): LedgerOperationsWritePort {
  return {
    async acquireOperationId(tx: Transaction, input) {
      const inserted = await tx
        .insert(schema.ledgerOperations)
        .values({
          sourceType: input.source.type,
          sourceId: input.source.id,
          operationCode: input.operationCode,
          operationVersion: input.operationVersion,
          idempotencyKey: input.idempotencyKey,
          payloadHash: input.payloadHash,
          postingDate: input.postingDate,
          status: "pending",
        })
        .onConflictDoNothing()
        .returning({ id: schema.ledgerOperations.id });

      if (inserted.length > 0) {
        return { operationId: inserted[0]!.id, isIdempotentReplay: false };
      }

      const [existing] = await tx
        .select({
          id: schema.ledgerOperations.id,
          sourceType: schema.ledgerOperations.sourceType,
          sourceId: schema.ledgerOperations.sourceId,
          payloadHash: schema.ledgerOperations.payloadHash,
        })
        .from(schema.ledgerOperations)
        .where(eq(schema.ledgerOperations.idempotencyKey, input.idempotencyKey))
        .limit(1);

      if (!existing) {
        throw new Error("Idempotency conflict but operation not found");
      }

      const existingSourceType = existing.sourceType ?? null;
      const existingSourceId = existing.sourceId ?? null;
      if (
        (existingSourceType !== null || existingSourceId !== null) &&
        (existingSourceType !== input.source.type ||
          existingSourceId !== input.source.id)
      ) {
        throw new IdempotencyConflictError(
          `Idempotency key is already used by another source: key=${input.idempotencyKey}, existing=${existing.sourceType}:${existing.sourceId}, requested=${input.source.type}:${input.source.id}`,
        );
      }

      if (existing.payloadHash !== input.payloadHash) {
        throw new IdempotencyConflictError(
          `Operation already exists with different payload hash for idempotencyKey=${input.idempotencyKey}`,
        );
      }

      return { operationId: existing.id, isIdempotentReplay: true };
    },
    async isReplayIncomplete(tx: Transaction, input) {
      const [[hasAnyPlan], [hasAnyPosting]] = await Promise.all([
        tx
          .select({ id: schema.tbTransferPlans.id })
          .from(schema.tbTransferPlans)
          .where(eq(schema.tbTransferPlans.operationId, input.operationId))
          .limit(1),
        tx
          .select({ id: schema.postings.id })
          .from(schema.postings)
          .where(eq(schema.postings.operationId, input.operationId))
          .limit(1),
      ]);

      const shouldHavePostings = input.lines.some((line) => line.type === "create");
      return !hasAnyPlan || (shouldHavePostings && !hasAnyPosting);
    },
    async insertPostings(tx: Transaction, rows) {
      await tx.insert(schema.postings).values(rows).onConflictDoNothing();
    },
    async insertTransferPlans(tx: Transaction, rows) {
      await tx.insert(schema.tbTransferPlans).values(rows).onConflictDoNothing();
    },
    async enqueuePostOperation(tx: Transaction, operationId: string) {
      await tx
        .insert(schema.outbox)
        .values({
          kind: "post_operation",
          refId: operationId,
          status: "pending",
        })
        .onConflictDoNothing();
    },
  };
}
