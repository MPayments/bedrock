import { isUuidLike } from "@bedrock/shared/core";

import type { ReconciliationExternalRecordRecord } from "../application/records/ports";
import type { ReconciliationExecutionFactsInput } from "../application/shared/external-ports";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    try {
      return BigInt(value.trim());
    } catch {
      return null;
    }
  }

  return null;
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function readUuid(value: unknown): string | null {
  return typeof value === "string" && isUuidLike(value) ? value : null;
}

export function extractTreasuryOperationFactFromReconciliationRecord(input: {
  record: ReconciliationExternalRecordRecord;
  matchedTreasuryOperationId: string | null;
  reconciliationRunId: string;
}): ReconciliationExecutionFactsInput | null {
  if (!input.matchedTreasuryOperationId) {
    return null;
  }

  if (input.record.normalizedPayload.skipExecutionFactNormalization === true) {
    return null;
  }

  const payload = input.record.normalizedPayload;
  const amountMinor = readBigInt(payload.amountMinor);
  const counterAmountMinor = readBigInt(payload.counterAmountMinor);
  const feeAmountMinor = readBigInt(payload.feeAmountMinor);

  if (
    amountMinor === null &&
    counterAmountMinor === null &&
    feeAmountMinor === null
  ) {
    return null;
  }

  const recordedAt =
    readDate(payload.recordedAt) ??
    readDate(payload.bookedAt) ??
    readDate(payload.executedAt) ??
    readDate(payload.valueDate) ??
    input.record.receivedAt;
  const confirmedAt =
    readDate(payload.confirmedAt) ??
    readDate(payload.settledAt) ??
    readDate(payload.executedAt) ??
    readDate(payload.bookedAt) ??
    recordedAt;

  return {
    amountMinor,
    confirmedAt,
    counterAmountMinor,
    counterCurrencyId: readUuid(payload.counterCurrencyId),
    currencyId: readUuid(payload.currencyId),
    externalRecordId:
      readString(payload.externalRecordId) ?? input.record.sourceRecordId,
    feeAmountMinor,
    feeCurrencyId: readUuid(payload.feeCurrencyId),
    instructionId: readUuid(payload.instructionId),
    metadata: {
      normalizationVersion: input.record.normalizationVersion,
      reconciliationExternalRecordId: input.record.id,
      reconciliationRunId: input.reconciliationRunId,
      reconciliationSource: input.record.source,
      reconciliationSourceRecordId: input.record.sourceRecordId,
    },
    notes:
      readString(payload.notes) ?? "Reconciliation matched external record",
    operationId: input.matchedTreasuryOperationId,
    providerRef: readString(payload.providerRef),
    recordedAt,
    routeLegId: readUuid(payload.routeLegId),
    sourceRef: `reconciliation-external-record:${input.record.id}`,
  };
}
