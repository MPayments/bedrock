import { describe, expect, it } from "vitest";

import { extractTreasuryOperationFactFromReconciliationRecord } from "../src/domain/execution-fact-normalization";

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

describe("execution fact normalization", () => {
  it("extracts a treasury fact candidate from matched reconciliation payload", () => {
    const candidate = extractTreasuryOperationFactFromReconciliationRecord({
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
      amountMinor: 9950n,
      confirmedAt: new Date("2026-04-14T09:05:00.000Z"),
      counterAmountMinor: null,
      counterCurrencyId: null,
      currencyId: "00000000-0000-4000-8000-000000000401",
      externalRecordId: "statement-line-1",
      feeAmountMinor: 50n,
      feeCurrencyId: "00000000-0000-4000-8000-000000000401",
      instructionId: "00000000-0000-4000-8000-000000000501",
      metadata: {
        normalizationVersion: 2,
        reconciliationExternalRecordId:
          "00000000-0000-4000-8000-000000000101",
        reconciliationRunId: "00000000-0000-4000-8000-000000000301",
        reconciliationSource: "bank_statement",
        reconciliationSourceRecordId: "statement-line-1",
      },
      notes: "Bank booking confirmed",
      operationId: "00000000-0000-4000-8000-000000000201",
      providerRef: "provider-1",
      recordedAt: new Date("2026-04-14T09:00:00.000Z"),
      routeLegId: "00000000-0000-4000-8000-000000000601",
      sourceRef:
        "reconciliation-external-record:00000000-0000-4000-8000-000000000101",
    });
  });

  it("skips normalization when the payload opts out", () => {
    const candidate = extractTreasuryOperationFactFromReconciliationRecord({
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

    expect(candidate).toBeNull();
  });

  it("returns null when matched treasury records do not carry economics", () => {
    const candidate = extractTreasuryOperationFactFromReconciliationRecord({
      matchedTreasuryOperationId:
        "00000000-0000-4000-8000-000000000201",
      reconciliationRunId: "00000000-0000-4000-8000-000000000301",
      record: createRecord({
        normalizedPayload: {
          providerRef: "provider-1",
        },
      }),
    });

    expect(candidate).toBeNull();
  });
});
