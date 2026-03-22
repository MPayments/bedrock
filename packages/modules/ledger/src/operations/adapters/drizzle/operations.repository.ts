import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  IdempotencyConflictError,
  LedgerError,
} from "../../../errors";
import { schema } from "../../../schema";
import type {
  AcquireOperationIdInput,
  LedgerOperationsRepository,
  LedgerPostingInsert,
  LedgerSettlementPlan,
} from "../../application/ports/operations.repository";
import type { IntentLine } from "../../domain/operation-intent";

function mapSettlementPlanRow(row: LedgerSettlementPlan) {
  return {
    operationId: row.operationId,
    lineNo: row.lineNo,
    type: row.type,
    transferId: row.settlementId,
    debitTbAccountId: row.debitAccountId,
    creditTbAccountId: row.creditAccountId,
    tbLedger: row.settlementLedger,
    amount: row.amount,
    code: row.code,
    pendingRef: row.pendingRef,
    pendingId: row.pendingId,
    isLinked: row.isLinked,
    isPending: row.isPending,
    timeoutSeconds: row.timeoutSeconds,
    status: row.status,
  };
}

export class DrizzleOperationsRepository implements LedgerOperationsRepository {
  constructor(private readonly db: Queryable) {}

  async acquireOperationId(input: AcquireOperationIdInput) {
    const inserted = await this.db
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

    const [existing] = await this.db
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
      throw new LedgerError("Idempotency conflict but operation not found");
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
  }

  async isReplayIncomplete(input: {
    operationId: string;
    lines: IntentLine[];
  }) {
    const [[hasAnyPlan], [hasAnyPosting]] = await Promise.all([
      this.db
        .select({ id: schema.tbTransferPlans.id })
        .from(schema.tbTransferPlans)
        .where(eq(schema.tbTransferPlans.operationId, input.operationId))
        .limit(1),
      this.db
        .select({ id: schema.postings.id })
        .from(schema.postings)
        .where(eq(schema.postings.operationId, input.operationId))
        .limit(1),
    ]);

    const shouldHavePostings = input.lines.some(
      (line) => line.type === "create",
    );
    return !hasAnyPlan || (shouldHavePostings && !hasAnyPosting);
  }

  async insertPostings(rows: LedgerPostingInsert[]) {
    await this.db.insert(schema.postings).values(rows).onConflictDoNothing();
  }

  async insertSettlementPlans(rows: LedgerSettlementPlan[]) {
    await this.db
      .insert(schema.tbTransferPlans)
      .values(rows.map(mapSettlementPlanRow))
      .onConflictDoNothing();
  }

  async enqueuePostOperation(operationId: string) {
    await this.db
      .insert(schema.outbox)
      .values({
        kind: "post_operation",
        refId: operationId,
        status: "pending",
      })
      .onConflictDoNothing();
  }
}
