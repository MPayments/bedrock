import { describe, expect, it, vi } from "vitest";

import { createRunReconciliationHandler } from "../src/application/runs/commands";

describe("reconciliation run normalization", () => {
  it("writes treasury execution actuals for matched treasury records with economics", async () => {
    const record = {
      causationId: null,
      correlationId: null,
      id: "00000000-0000-4000-8000-000000000111",
      normalizationVersion: 1,
      normalizedPayload: {
        amountMinor: "9950",
        currencyId: "00000000-0000-4000-8000-000000000401",
        externalRecordId: "statement-line-1",
        feeAmountMinor: "50",
        feeCurrencyId: "00000000-0000-4000-8000-000000000401",
        operationId: "00000000-0000-4000-8000-000000000201",
        operationKind: "treasury",
      },
      payloadHash: "hash-1",
      rawPayload: {},
      receivedAt: new Date("2026-04-14T09:00:00.000Z"),
      requestId: null,
      source: "bank_statement",
      sourceRecordId: "statement-line-1",
      traceId: null,
    };
    const recordExecutionFee = vi.fn(async () => undefined);
    const recordExecutionFill = vi.fn(async () => undefined);
    const createManyMatches = vi.fn(async () => undefined);
    const createManyExceptions = vi.fn(async () => undefined);
    const findTreasuryOperation = vi.fn(async () => true);
    const runReconciliation = createRunReconciliationHandler({
      documents: {
        existsById: vi.fn(async () => false),
      },
      exceptions: {} as any,
      ledgerLookup: {
        operationExists: vi.fn(async () => false),
        treasuryOperationExists: findTreasuryOperation,
      },
      log: {
        child: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        info: vi.fn(),
        trace: vi.fn(),
        warn: vi.fn(),
      } as any,
      matches: {} as any,
      pendingSources: {} as any,
      transactions: {
        async withTransaction(run) {
          return run({
            exceptions: {
              createMany: createManyExceptions,
              findByIdForUpdate: vi.fn(),
              markIgnored: vi.fn(),
              markResolved: vi.fn(),
            },
            executionFacts: {
              recordCashMovement: vi.fn(async () => undefined),
              recordExecutionFee,
              recordExecutionFill,
            },
            externalRecords: {
              create: vi.fn(),
              findBySourceAndSourceRecordId: vi.fn(),
              listForRun: vi.fn(async () => [record]),
            },
            idempotency: {
              withIdempotency: async ({ handler }) => handler(),
            },
            matches: {
              createMany: createManyMatches,
            },
            runs: {
              create: vi.fn(async (input) => ({
                ...input,
                createdAt: new Date("2026-04-14T09:01:00.000Z"),
                id: "00000000-0000-4000-8000-000000000301",
              })),
              findById: vi.fn(),
            },
          });
        },
      },
    });

    const result = await runReconciliation({
      idempotencyKey: "run-1",
      inputQuery: {},
      rulesetChecksum: "ruleset-1",
      source: "bank_statement",
    });

    expect(result.id).toBe("00000000-0000-4000-8000-000000000301");
    expect(findTreasuryOperation).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000201",
    );
    expect(createManyMatches).toHaveBeenCalledTimes(1);
    expect(createManyExceptions).not.toHaveBeenCalled();
    expect(recordExecutionFill).toHaveBeenCalledWith({
      actualRateDen: null,
      actualRateNum: null,
      boughtAmountMinor: null,
      boughtCurrencyId: null,
      calculationSnapshotId: null,
      confirmedAt: new Date("2026-04-14T09:00:00.000Z"),
      executedAt: new Date("2026-04-14T09:00:00.000Z"),
      externalRecordId: "statement-line-1",
      instructionId: null,
      metadata: {
        classification: null,
        componentFamily: null,
        normalizationVersion: 1,
        reconciliationExternalRecordId:
          "00000000-0000-4000-8000-000000000111",
        reconciliationRunId: "00000000-0000-4000-8000-000000000301",
        reconciliationSource: "bank_statement",
        reconciliationSourceRecordId: "statement-line-1",
      },
      notes: "Reconciliation matched external record",
      operationId: "00000000-0000-4000-8000-000000000201",
      providerCounterpartyId: null,
      providerRef: null,
      routeLegId: null,
      routeVersionId: null,
      soldAmountMinor: 9950n,
      soldCurrencyId: "00000000-0000-4000-8000-000000000401",
      sourceRef:
        "reconciliation-external-record:00000000-0000-4000-8000-000000000111:fill",
    });
    expect(recordExecutionFee).toHaveBeenCalledWith({
      amountMinor: 50n,
      calculationSnapshotId: null,
      chargedAt: new Date("2026-04-14T09:00:00.000Z"),
      componentCode: null,
      confirmedAt: new Date("2026-04-14T09:00:00.000Z"),
      currencyId: "00000000-0000-4000-8000-000000000401",
      externalRecordId: "statement-line-1",
      feeFamily: "provider_fee",
      fillId: null,
      instructionId: null,
      metadata: {
        classification: null,
        componentFamily: null,
        normalizationVersion: 1,
        reconciliationExternalRecordId:
          "00000000-0000-4000-8000-000000000111",
        reconciliationRunId: "00000000-0000-4000-8000-000000000301",
        reconciliationSource: "bank_statement",
        reconciliationSourceRecordId: "statement-line-1",
      },
      notes: "Reconciliation matched external record",
      operationId: "00000000-0000-4000-8000-000000000201",
      providerCounterpartyId: null,
      providerRef: null,
      routeComponentId: null,
      routeLegId: null,
      routeVersionId: null,
      sourceRef:
        "reconciliation-external-record:00000000-0000-4000-8000-000000000111:fee",
    });
  });

  it("does not write treasury execution actuals for unmatched records", async () => {
    const recordExecutionFee = vi.fn(async () => undefined);
    const recordExecutionFill = vi.fn(async () => undefined);
    const runReconciliation = createRunReconciliationHandler({
      documents: {
        existsById: vi.fn(async () => false),
      },
      exceptions: {} as any,
      ledgerLookup: {
        operationExists: vi.fn(async () => false),
        treasuryOperationExists: vi.fn(async () => false),
      },
      log: {
        child: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        info: vi.fn(),
        trace: vi.fn(),
        warn: vi.fn(),
      } as any,
      matches: {} as any,
      pendingSources: {} as any,
      transactions: {
        async withTransaction(run) {
          return run({
            exceptions: {
              createMany: vi.fn(async () => undefined),
              findByIdForUpdate: vi.fn(),
              markIgnored: vi.fn(),
              markResolved: vi.fn(),
            },
            executionFacts: {
              recordCashMovement: vi.fn(async () => undefined),
              recordExecutionFee,
              recordExecutionFill,
            },
            externalRecords: {
              create: vi.fn(),
              findBySourceAndSourceRecordId: vi.fn(),
              listForRun: vi.fn(async () => [
                {
                  causationId: null,
                  correlationId: null,
                  id: "00000000-0000-4000-8000-000000000112",
                  normalizationVersion: 1,
                  normalizedPayload: {
                    amountMinor: "9950",
                    operationId: "00000000-0000-4000-8000-000000000202",
                    operationKind: "treasury",
                  },
                  payloadHash: "hash-2",
                  rawPayload: {},
                  receivedAt: new Date("2026-04-14T09:00:00.000Z"),
                  requestId: null,
                  source: "bank_statement",
                  sourceRecordId: "statement-line-2",
                  traceId: null,
                },
              ]),
            },
            idempotency: {
              withIdempotency: async ({ handler }) => handler(),
            },
            matches: {
              createMany: vi.fn(async () => undefined),
            },
            runs: {
              create: vi.fn(async (input) => ({
                ...input,
                createdAt: new Date("2026-04-14T09:01:00.000Z"),
                id: "00000000-0000-4000-8000-000000000302",
              })),
              findById: vi.fn(),
            },
          });
        },
      },
    });

    await runReconciliation({
      idempotencyKey: "run-2",
      inputQuery: {},
      rulesetChecksum: "ruleset-1",
      source: "bank_statement",
    });

    expect(recordExecutionFee).not.toHaveBeenCalled();
    expect(recordExecutionFill).not.toHaveBeenCalled();
  });
});
