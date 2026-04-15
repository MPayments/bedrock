import type { FinanceDealWorkbench } from "./queries";

type ExecutionActualMetadata = Record<string, unknown> | null;

export type ExecutionActualOperationContext = {
  calculationSnapshotId: string | null;
  instructionId: string | null;
  operationId: string;
  routeLegId: string | null;
  routeVersionId: string | null;
};

export type RecordExecutionFillPayload = {
  boughtAmountMinor: string;
  boughtCurrencyId: string;
  executedAt: string;
  externalRecordId: string | null;
  fillSequence: number | null;
  metadata: ExecutionActualMetadata;
  notes: string | null;
  providerRef: string | null;
  soldAmountMinor: string;
  soldCurrencyId: string;
};

export type RecordExecutionFeePayload = {
  amountMinor: string;
  chargedAt: string;
  componentCode: string | null;
  currencyId: string;
  externalRecordId: string | null;
  feeFamily: string;
  fillId: string | null;
  notes: string | null;
  providerRef: string | null;
};

export type RecordCashMovementPayload = {
  accountRef: string | null;
  amountMinor: string;
  bookedAt: string;
  currencyId: string;
  direction: "credit" | "debit";
  externalRecordId: string | null;
  notes: string | null;
  providerRef: string | null;
  requisiteId: string | null;
  statementRef: string | null;
  valueDate: string | null;
};

function findRouteLegIdByOperationId(
  deal: FinanceDealWorkbench,
  operationId: string,
): string | null {
  return (
    deal.executionPlan.find((leg) =>
      leg.operationRefs.some((operationRef) => operationRef.operationId === operationId),
    )?.id ?? null
  );
}

export function findExecutionActualOperationContext(
  deal: FinanceDealWorkbench,
  operationId: string,
): ExecutionActualOperationContext | null {
  const operation = deal.relatedResources.operations.find(
    (item) => item.id === operationId,
  );

  if (!operation) {
    return null;
  }

  return {
    calculationSnapshotId: deal.acceptedCalculation?.snapshotId ?? null,
    instructionId: operation.latestInstruction?.id ?? null,
    operationId,
    routeLegId: findRouteLegIdByOperationId(deal, operationId),
    routeVersionId: deal.acceptedCalculation?.routeVersionId ?? null,
  };
}

export function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseOptionalPositiveInteger(value: string): number | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!/^[1-9]\d*$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized, 10);
}

export function parseMetadataInput(input: string): {
  message?: string;
  ok: boolean;
  value: ExecutionActualMetadata;
} {
  const normalized = input.trim();

  if (!normalized) {
    return {
      ok: true,
      value: null,
    };
  }

  try {
    const parsed = JSON.parse(normalized);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {
        message: "Metadata должна быть JSON-объектом",
        ok: false,
        value: null,
      };
    }

    return {
      ok: true,
      value: parsed as Record<string, unknown>,
    };
  } catch {
    return {
      message: "Metadata должна быть валидным JSON",
      ok: false,
      value: null,
    };
  }
}

export function buildExecutionFillPayload(
  context: ExecutionActualOperationContext,
  input: RecordExecutionFillPayload,
) {
  return {
    actualRateDen: null,
    actualRateNum: null,
    boughtAmountMinor: input.boughtAmountMinor,
    boughtCurrencyId: input.boughtCurrencyId,
    calculationSnapshotId: context.calculationSnapshotId,
    confirmedAt: null,
    executedAt: input.executedAt,
    externalRecordId: input.externalRecordId,
    fillSequence: input.fillSequence,
    instructionId: context.instructionId,
    metadata: input.metadata,
    notes: input.notes,
    providerCounterpartyId: null,
    providerRef: input.providerRef,
    routeLegId: context.routeLegId,
    routeVersionId: context.routeVersionId,
    soldAmountMinor: input.soldAmountMinor,
    soldCurrencyId: input.soldCurrencyId,
    sourceKind: "manual" as const,
  };
}

export function buildExecutionFeePayload(
  context: ExecutionActualOperationContext,
  input: RecordExecutionFeePayload,
) {
  return {
    amountMinor: input.amountMinor,
    calculationSnapshotId: context.calculationSnapshotId,
    chargedAt: input.chargedAt,
    componentCode: input.componentCode,
    confirmedAt: null,
    currencyId: input.currencyId,
    externalRecordId: input.externalRecordId,
    feeFamily: input.feeFamily,
    fillId: input.fillId,
    instructionId: context.instructionId,
    metadata: null,
    notes: input.notes,
    providerCounterpartyId: null,
    providerRef: input.providerRef,
    routeComponentId: null,
    routeLegId: context.routeLegId,
    routeVersionId: context.routeVersionId,
    sourceKind: "manual" as const,
  };
}

export function buildCashMovementPayload(
  context: ExecutionActualOperationContext,
  input: RecordCashMovementPayload,
) {
  return {
    accountRef: input.accountRef,
    amountMinor: input.amountMinor,
    bookedAt: input.bookedAt,
    calculationSnapshotId: context.calculationSnapshotId,
    confirmedAt: null,
    currencyId: input.currencyId,
    direction: input.direction,
    externalRecordId: input.externalRecordId,
    instructionId: context.instructionId,
    metadata: null,
    notes: input.notes,
    providerCounterpartyId: null,
    providerRef: input.providerRef,
    requisiteId: input.requisiteId,
    routeLegId: context.routeLegId,
    routeVersionId: context.routeVersionId,
    sourceKind: "manual" as const,
    statementRef: input.statementRef,
    valueDate: input.valueDate,
  };
}
