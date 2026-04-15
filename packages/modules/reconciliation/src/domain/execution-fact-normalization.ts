import { isUuidLike } from "@bedrock/shared/core";

import type { ReconciliationExternalRecordRecord } from "../application/records/ports";
import type {
  ReconciliationCashMovementInput,
  ReconciliationExecutionFeeInput,
  ReconciliationExecutionFillInput,
} from "../application/shared/external-ports";

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

function readDirection(value: unknown): "credit" | "debit" | null {
  return value === "credit" || value === "debit" ? value : null;
}

type ReconciliationNormalizedExecutionActuals = {
  cashMovement: ReconciliationCashMovementInput | null;
  fee: ReconciliationExecutionFeeInput | null;
  fill: ReconciliationExecutionFillInput | null;
};

export function extractTreasuryExecutionActualsFromReconciliationRecord(input: {
  record: ReconciliationExternalRecordRecord;
  matchedTreasuryOperationId: string | null;
  reconciliationRunId: string;
}): ReconciliationNormalizedExecutionActuals {
  if (!input.matchedTreasuryOperationId) {
    return {
      cashMovement: null,
      fee: null,
      fill: null,
    };
  }

  if (input.record.normalizedPayload.skipExecutionFactNormalization === true) {
    return {
      cashMovement: null,
      fee: null,
      fill: null,
    };
  }

  const payload = input.record.normalizedPayload;
  const soldAmountMinor = readBigInt(payload.amountMinor);
  const boughtAmountMinor = readBigInt(payload.counterAmountMinor);
  const feeAmountMinor = readBigInt(payload.feeAmountMinor);
  const executedAt =
    readDate(payload.executedAt) ??
    readDate(payload.recordedAt) ??
    readDate(payload.bookedAt) ??
    input.record.receivedAt;
  const confirmedAt =
    readDate(payload.confirmedAt) ??
    readDate(payload.settledAt) ??
    readDate(payload.executedAt) ??
    readDate(payload.bookedAt) ??
    executedAt;
  const commonMetadata = {
    normalizationVersion: input.record.normalizationVersion,
    reconciliationExternalRecordId: input.record.id,
    reconciliationRunId: input.reconciliationRunId,
    reconciliationSource: input.record.source,
    reconciliationSourceRecordId: input.record.sourceRecordId,
  } satisfies Record<string, unknown>;
  const externalRecordId =
    readString(payload.externalRecordId) ?? input.record.sourceRecordId;
  const providerRef = readString(payload.providerRef);
  const providerCounterpartyId = readUuid(payload.providerCounterpartyId);
  const routeVersionId = readUuid(payload.routeVersionId);
  const routeLegId = readUuid(payload.routeLegId);
  const calculationSnapshotId = readUuid(payload.calculationSnapshotId);
  const instructionId = readUuid(payload.instructionId);

  const fill =
    soldAmountMinor === null && boughtAmountMinor === null
      ? null
      : {
          actualRateDen: readBigInt(payload.actualRateDen),
          actualRateNum: readBigInt(payload.actualRateNum),
          boughtAmountMinor,
          boughtCurrencyId: readUuid(payload.counterCurrencyId),
          calculationSnapshotId,
          confirmedAt,
          executedAt,
          externalRecordId,
          instructionId,
          metadata: {
            ...commonMetadata,
            classification: readString(payload.classification),
            componentFamily: readString(payload.componentFamily),
          },
          notes:
            readString(payload.notes) ?? "Reconciliation matched external record",
          operationId: input.matchedTreasuryOperationId,
          providerCounterpartyId,
          providerRef,
          routeLegId,
          routeVersionId,
          soldAmountMinor,
          soldCurrencyId: readUuid(payload.currencyId),
          sourceRef: `reconciliation-external-record:${input.record.id}:fill`,
        };

  const fee =
    feeAmountMinor === null
      ? null
      : {
          amountMinor: feeAmountMinor,
          calculationSnapshotId,
          chargedAt:
            readDate(payload.chargedAt) ??
            readDate(payload.bookedAt) ??
            readDate(payload.valueDate) ??
            executedAt,
          componentCode: readString(payload.componentCode),
          confirmedAt,
          currencyId: readUuid(payload.feeCurrencyId),
          externalRecordId,
          feeFamily:
            readString(payload.feeFamily) ??
            readString(payload.feeComponentFamily) ??
            "provider_fee",
          fillId: null,
          instructionId,
          metadata: {
            ...commonMetadata,
            classification:
              readString(payload.feeClassification) ??
              readString(payload.classification),
            componentFamily:
              readString(payload.feeComponentFamily) ??
              readString(payload.componentFamily),
          },
          notes:
            readString(payload.notes) ?? "Reconciliation matched external record",
          operationId: input.matchedTreasuryOperationId,
          providerCounterpartyId,
          providerRef,
          routeComponentId: readUuid(payload.routeComponentId),
          routeLegId,
          routeVersionId,
          sourceRef: `reconciliation-external-record:${input.record.id}:fee`,
        };

  const cashMovementDirection = readDirection(payload.direction);
  const cashMovement =
    cashMovementDirection === null || soldAmountMinor === null
      ? null
      : {
          accountRef: readString(payload.accountRef),
          amountMinor: soldAmountMinor,
          bookedAt:
            readDate(payload.bookedAt) ??
            readDate(payload.valueDate) ??
            executedAt,
          calculationSnapshotId,
          confirmedAt,
          currencyId: readUuid(payload.currencyId),
          direction: cashMovementDirection,
          externalRecordId,
          instructionId,
          metadata: commonMetadata,
          notes:
            readString(payload.notes) ?? "Reconciliation matched external record",
          operationId: input.matchedTreasuryOperationId,
          providerCounterpartyId,
          providerRef,
          requisiteId: readUuid(payload.requisiteId),
          routeLegId,
          routeVersionId,
          sourceRef: `reconciliation-external-record:${input.record.id}:cash`,
          statementRef: readString(payload.statementRef),
          valueDate:
            readDate(payload.valueDate) ??
            readDate(payload.bookedAt) ??
            null,
        };

  return {
    cashMovement,
    fee,
    fill,
  };
}
