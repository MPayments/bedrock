import { describe, expect, it, vi } from "vitest";

import { createRunReconciliationHandler } from "../src/application/runs/commands";

describe("reconciliation run normalization", () => {
  it("writes treasury operation facts for matched treasury records with economics", async () => {
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
    const recordTreasuryOperationFact = vi.fn(async () => undefined);
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
              recordTreasuryOperationFact,
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
    expect(recordTreasuryOperationFact).toHaveBeenCalledWith({
      amountMinor: 9950n,
      confirmedAt: new Date("2026-04-14T09:00:00.000Z"),
      counterAmountMinor: null,
      counterCurrencyId: null,
      currencyId: "00000000-0000-4000-8000-000000000401",
      externalRecordId: "statement-line-1",
      feeAmountMinor: 50n,
      feeCurrencyId: "00000000-0000-4000-8000-000000000401",
      instructionId: null,
      metadata: {
        normalizationVersion: 1,
        reconciliationExternalRecordId:
          "00000000-0000-4000-8000-000000000111",
        reconciliationRunId: "00000000-0000-4000-8000-000000000301",
        reconciliationSource: "bank_statement",
        reconciliationSourceRecordId: "statement-line-1",
      },
      notes: "Reconciliation matched external record",
      operationId: "00000000-0000-4000-8000-000000000201",
      providerRef: null,
      recordedAt: new Date("2026-04-14T09:00:00.000Z"),
      routeLegId: null,
      sourceRef:
        "reconciliation-external-record:00000000-0000-4000-8000-000000000111",
    });
  });

  it("does not write treasury facts for unmatched records", async () => {
    const recordTreasuryOperationFact = vi.fn(async () => undefined);
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
              recordTreasuryOperationFact,
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

    expect(recordTreasuryOperationFact).not.toHaveBeenCalled();
  });
});
