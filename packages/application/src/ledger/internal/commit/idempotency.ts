import { eq } from "drizzle-orm";

import {
  computeDimensionsHash,
  tbTransferIdForOperation,
} from "@bedrock/application/ledger/ids";
import { schema } from "@bedrock/application/ledger/schema";
import { sha256Hex, stableStringify } from "@bedrock/common";
import type { Transaction } from "@bedrock/common/db/types";

import {
  IdempotencyConflictError,
} from "../../errors";
import { OPERATION_TRANSFER_TYPE, type IntentLine } from "../../types";

function normalizeForFingerprint(line: IntentLine) {
  switch (line.type) {
    case OPERATION_TRANSFER_TYPE.CREATE:
      return {
        type: line.type,
        planRef: line.planRef,
        bookId: line.bookId,
        chain: line.chain ?? null,
        postingCode: line.postingCode,
        debit: {
          accountNo: line.debit.accountNo,
          currency: line.debit.currency,
          dimensionsHash: computeDimensionsHash(line.debit.dimensions),
        },
        credit: {
          accountNo: line.credit.accountNo,
          currency: line.credit.currency,
          dimensionsHash: computeDimensionsHash(line.credit.dimensions),
        },
        amount: line.amountMinor.toString(),
        code: line.code ?? 1,
        pendingTimeoutSeconds: line.pending?.timeoutSeconds ?? 0,
        pendingRef: line.pending?.ref ?? null,
      };
    case OPERATION_TRANSFER_TYPE.POST_PENDING:
      return {
        type: line.type,
        planRef: line.planRef,
        chain: line.chain ?? null,
        currency: line.currency,
        pendingId: line.pendingId.toString(),
        amount: (line.amount ?? 0n).toString(),
        code: line.code ?? 0,
      };
    case OPERATION_TRANSFER_TYPE.VOID_PENDING:
      return {
        type: line.type,
        planRef: line.planRef,
        chain: line.chain ?? null,
        currency: line.currency,
        pendingId: line.pendingId.toString(),
        amount: "0",
        code: line.code ?? 0,
      };
  }
}

export function computeLinkedFlags(lines: IntentLine[]): boolean[] {
  const linked = new Array(lines.length).fill(false);
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i]!.chain;
    const b = lines[i + 1]!.chain;
    if (a && b && a === b) linked[i] = true;
  }
  return linked;
}

export function computePayloadHash(input: {
  operationCode: string;
  operationVersion: number;
  payload: unknown;
  lines: IntentLine[];
}): string {
  return sha256Hex(
    stableStringify({
      operationCode: input.operationCode,
      operationVersion: input.operationVersion,
      payload: input.payload ?? null,
      lines: input.lines.map(normalizeForFingerprint),
    }),
  );
}

export async function acquireOperationId(input: {
  tx: Transaction;
  source: { type: string; id: string };
  operationCode: string;
  operationVersion: number;
  idempotencyKey: string;
  payloadHash: string;
  postingDate: Date;
}): Promise<{ operationId: string; isIdempotentReplay: boolean }> {
  const { tx } = input;
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
}

export async function isReplayIncomplete(input: {
  tx: Transaction;
  operationId: string;
  lines: IntentLine[];
}): Promise<boolean> {
  const { tx, operationId, lines } = input;
  const [[hasAnyPlan], [hasAnyPosting]] = await Promise.all([
    tx
      .select({ id: schema.tbTransferPlans.id })
      .from(schema.tbTransferPlans)
      .where(eq(schema.tbTransferPlans.operationId, operationId))
      .limit(1),
    tx
      .select({ id: schema.postings.id })
      .from(schema.postings)
      .where(eq(schema.postings.operationId, operationId))
      .limit(1),
  ]);

  const shouldHavePostings = lines.some(
    (line) => line.type === OPERATION_TRANSFER_TYPE.CREATE,
  );
  return !hasAnyPlan || (shouldHavePostings && !hasAnyPosting);
}

export function buildReplayTransferMaps(
  operationId: string,
  lines: IntentLine[],
) {
  const pendingTransferIdsByRef = new Map<string, bigint>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i]!;
    const transferId = tbTransferIdForOperation(
      operationId,
      lineNo,
      line.planRef,
    );

    if (line.type === OPERATION_TRANSFER_TYPE.CREATE && line.pending) {
      pendingTransferIdsByRef.set(line.pending.ref ?? line.planRef, transferId);
    }
  }

  return { pendingTransferIdsByRef };
}
