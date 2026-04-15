import { describe, expect, it } from "vitest";

import { extractTreasuryExecutionActualsFromReconciliationRecord } from "../src/domain/execution-fact-normalization";

function createRecord(overrides?: {
  normalizedPayload?: Record<string, unknown>;
}) {
  return {
    causationId: null,
    correlationId: null,
    id: "00000000-0000-4000-8000-000000000101",
    normalizationVersion: 2,
    normalizedPayload: overrides?.normalizedPayload ?? {},
    payloadHash: "hash-1",
    rawPayload: {},
    receivedAt: new Date("2026-04-14T09:00:00.000Z"),
    requestId: null,
    source: "bank_statement",
    sourceRecordId: "statement-line-1",
    traceId: null,
  };
}

describe("execution actual normalization", () => {
  it("extracts treasury execution actual candidates from matched reconciliation payload", () => {
    const candidate = extractTreasuryExecutionActualsFromReconciliationRecord({
      matchedTreasuryOperationId:
        "00000000-0000-4000-8000-000000000201",
      reconciliationRunId: "00000000-0000-4000-8000-000000000301",
      record: createRecord({
        normalizedPayload: {
          amountMinor: "9950",
          confirmedAt: "2026-04-14T09:05:00.000Z",
          currencyId: "00000000-0000-4000-8000-000000000401",
          feeAmountMinor: "50",
          feeCurrencyId: "00000000-0000-4000-8000-000000000401",
          instructionId: "00000000-0000-4000-8000-000000000501",
          notes: "Bank booking confirmed",
          providerRef: "provider-1",
          routeLegId: "00000000-0000-4000-8000-000000000601",
        },
      }),
    });

    expect(candidate).toEqual({
      cashMovement: null,
      fee: {
        amountMinor: 50n,
        calculationSnapshotId: null,
        chargedAt: new Date("2026-04-14T09:00:00.000Z"),
        componentCode: null,
        confirmedAt: new Date("2026-04-14T09:05:00.000Z"),
        currencyId: "00000000-0000-4000-8000-000000000401",
        externalRecordId: "statement-line-1",
        feeFamily: "provider_fee",
        fillId: null,
        instructionId: "00000000-0000-4000-8000-000000000501",
        metadata: {
          classification: null,
          componentFamily: null,
          normalizationVersion: 2,
          reconciliationExternalRecordId:
            "00000000-0000-4000-8000-000000000101",
          reconciliationRunId: "00000000-0000-4000-8000-000000000301",
          reconciliationSource: "bank_statement",
          reconciliationSourceRecordId: "statement-line-1",
        },
        notes: "Bank booking confirmed",
        operationId: "00000000-0000-4000-8000-000000000201",
        providerCounterpartyId: null,
        providerRef: "provider-1",
        routeComponentId: null,
        routeLegId: "00000000-0000-4000-8000-000000000601",
        routeVersionId: null,
        sourceRef:
          "reconciliation-external-record:00000000-0000-4000-8000-000000000101:fee",
      },
      fill: {
        actualRateDen: null,
        actualRateNum: null,
        boughtAmountMinor: null,
        boughtCurrencyId: null,
        calculationSnapshotId: null,
        confirmedAt: new Date("2026-04-14T09:05:00.000Z"),
        executedAt: new Date("2026-04-14T09:00:00.000Z"),
        externalRecordId: "statement-line-1",
        instructionId: "00000000-0000-4000-8000-000000000501",
        metadata: {
          classification: null,
          componentFamily: null,
          normalizationVersion: 2,
          reconciliationExternalRecordId:
            "00000000-0000-4000-8000-000000000101",
          reconciliationRunId: "00000000-0000-4000-8000-000000000301",
          reconciliationSource: "bank_statement",
          reconciliationSourceRecordId: "statement-line-1",
        },
        notes: "Bank booking confirmed",
        operationId: "00000000-0000-4000-8000-000000000201",
        providerCounterpartyId: null,
        providerRef: "provider-1",
        routeLegId: "00000000-0000-4000-8000-000000000601",
        routeVersionId: null,
        soldAmountMinor: 9950n,
        soldCurrencyId: "00000000-0000-4000-8000-000000000401",
        sourceRef:
          "reconciliation-external-record:00000000-0000-4000-8000-000000000101:fill",
      },
    });
  });

  it("skips normalization when the payload opts out", () => {
    const candidate = extractTreasuryExecutionActualsFromReconciliationRecord({
      matchedTreasuryOperationId:
        "00000000-0000-4000-8000-000000000201",
      reconciliationRunId: "00000000-0000-4000-8000-000000000301",
      record: createRecord({
        normalizedPayload: {
          amountMinor: "9950",
          skipExecutionFactNormalization: true,
        },
      }),
    });

    expect(candidate).toEqual({
      cashMovement: null,
      fee: null,
      fill: null,
    });
  });

  it("returns empty actuals when matched treasury records do not carry economics", () => {
    const candidate = extractTreasuryExecutionActualsFromReconciliationRecord({
      matchedTreasuryOperationId:
        "00000000-0000-4000-8000-000000000201",
      reconciliationRunId: "00000000-0000-4000-8000-000000000301",
      record: createRecord({
        normalizedPayload: {
          providerRef: "provider-1",
        },
      }),
    });

    expect(candidate).toEqual({
      cashMovement: null,
      fee: null,
      fill: null,
    });
  });
});
