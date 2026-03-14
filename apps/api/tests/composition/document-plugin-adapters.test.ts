import { describe, expect, it, vi } from "vitest";

import { schema as documentsSchema } from "@bedrock/documents/schema";
import { schema as fxSchema } from "@bedrock/fx/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";

import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "../../src/composition/document-plugin-adapters";

describe("document plugin adapters composition", () => {
  it("builds commercial quote snapshots from app-owned query adapters", async () => {
    const quote = {
      id: "550e8400-e29b-41d4-a716-446655440010",
      fromCurrencyId: "cur-usd",
      toCurrencyId: "cur-usdt",
      fromAmountMinor: 10_000n,
      toAmountMinor: 123_456n,
      pricingMode: "explicit_route",
      pricingTrace: { version: "v1", mode: "explicit_route" },
      rateNum: 15432n,
      rateDen: 1250n,
      expiresAt: new Date("2026-03-03T10:10:00.000Z"),
      idempotencyKey: "quote-ref-crypto",
    };
    const legs = [
      {
        quoteId: quote.id,
        idx: 1,
        fromCurrencyId: "cur-usd",
        toCurrencyId: "cur-usdt",
        fromAmountMinor: 10_000n,
        toAmountMinor: 123_456n,
        rateNum: 15432n,
        rateDen: 1250n,
        sourceKind: "manual",
        sourceRef: "desk",
        asOf: new Date("2026-03-03T10:00:00.000Z"),
        executionCounterpartyId: null,
      },
    ];
    const financialLines = [
      {
        quoteId: quote.id,
        idx: 1,
        bucket: "fee_revenue",
        currencyId: "cur-usdt",
        amountMinor: 123_456n,
        source: "rule",
        settlementMode: "in_ledger",
        memo: null,
        metadata: null,
      },
    ];
    const db = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === fxSchema.fxQuotes) {
            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => [quote]),
              })),
            };
          }
          if (table === fxSchema.fxQuoteLegs) {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => legs),
              })),
            };
          }
          if (table === fxSchema.fxQuoteFinancialLines) {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => financialLines),
              })),
            };
          }

          throw new Error("unexpected table");
        }),
      })),
    };
    const currenciesService = {
      findById: vi.fn(async (id: string) => {
        if (id === "cur-usd") {
          return { id, code: "USD", precision: 2 };
        }
        if (id === "cur-usdt") {
          return { id, code: "USDT", precision: 6 };
        }

        throw new Error(`Unknown currency ${id}`);
      }),
    };
    const requisitesService = {
      resolveBindings: vi.fn(async () => []),
      findById: vi.fn(),
    };

    const deps = createCommercialDocumentDeps({
      currenciesService: currenciesService as any,
      requisitesService: requisitesService as any,
    });

    const snapshot = await deps.quoteSnapshot.loadQuoteSnapshot({
      db: db as any,
      quoteRef: "quote-ref-crypto",
    });

    expect(snapshot.financialLines).toEqual([
      expect.objectContaining({
        currency: "USDT",
        amount: "0.123456",
        amountMinor: "123456",
      }),
    ]);
    expect(currenciesService.findById).toHaveBeenCalledWith("cur-usdt");
  });

  it("builds IFRS transfer lookup adapters from app-owned query wiring", async () => {
    const dependencyDocument = {
      id: "doc-transfer-1",
      docType: "transfer_intra",
      payload: { amountMinor: "1000" },
      occurredAt: new Date("2026-03-04T10:00:00.000Z"),
    };
    const pendingTransfers = [
      {
        transferId: 1n,
        pendingRef: "pending-1",
        amountMinor: 1000n,
      },
    ];
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn((table: unknown) => {
            if (table !== documentsSchema.documents) {
              throw new Error("unexpected transfer dependency table");
            }

            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => [dependencyDocument]),
              })),
            };
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn((table: unknown) => {
            if (table !== documentsSchema.documentOperations) {
              throw new Error("unexpected pending transfer table");
            }

            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{ operationId: "op-transfer-1" }]),
              })),
            };
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn((table: unknown) => {
            expect(table).toBe(ledgerSchema.tbTransferPlans);

            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => pendingTransfers),
              })),
            };
          }),
        }),
    };
    const deps = createIfrsDocumentDeps({
      currenciesService: {
        findById: vi.fn(),
      } as any,
      fxService: {
        quote: vi.fn(),
      } as any,
      requisitesService: {
        resolveBindings: vi.fn(async () => []),
        findById: vi.fn(),
      } as any,
    });

    await expect(
      deps.transferLookup.resolveTransferDependencyDocument({
        db: db as any,
        transferDocumentId: "doc-transfer-1",
      }),
    ).resolves.toEqual(dependencyDocument);
    await expect(
      deps.transferLookup.listPendingTransfers({
        db: db as any,
        transferDocumentId: "doc-transfer-1",
      }),
    ).resolves.toEqual(pendingTransfers);
  });

  it("builds IFRS quote snapshot and FX dependency adapters from app-owned wiring", async () => {
    const quote = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      fromCurrencyId: "cur-usd",
      toCurrencyId: "cur-eur",
      fromAmountMinor: 10_000n,
      toAmountMinor: 9_200n,
      pricingMode: "explicit_route",
      pricingTrace: { version: "v1", mode: "explicit_route" },
      rateNum: 23n,
      rateDen: 25n,
      status: "active",
      usedByRef: null,
      expiresAt: new Date("2026-03-03T10:10:00.000Z"),
      idempotencyKey: "quote-ref-1",
    };
    const dependencyDocument = {
      id: "doc-fx-1",
      docType: "fx_execute",
      payload: { quoteRef: "quote-ref-1" },
      occurredAt: new Date("2026-03-03T10:00:00.000Z"),
    };
    const db = {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === fxSchema.fxQuotes) {
            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => [quote]),
              })),
            };
          }

          if (table === fxSchema.fxQuoteLegs) {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => [
                  {
                    quoteId: quote.id,
                    idx: 1,
                    fromCurrencyId: "cur-usd",
                    toCurrencyId: "cur-eur",
                    fromAmountMinor: 10_000n,
                    toAmountMinor: 9_200n,
                    rateNum: 23n,
                    rateDen: 25n,
                    sourceKind: "manual",
                    sourceRef: "desk",
                    asOf: new Date("2026-03-03T10:00:00.000Z"),
                    executionCounterpartyId: null,
                  },
                ]),
              })),
            };
          }

          if (table === fxSchema.fxQuoteFinancialLines) {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => []),
              })),
            };
          }

          if (table === documentsSchema.documents) {
            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => [dependencyDocument]),
              })),
            };
          }

          if (table === documentsSchema.documentOperations) {
            return {
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{ operationId: "op-fx-1" }]),
              })),
            };
          }

          if (table === ledgerSchema.tbTransferPlans) {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => [
                  {
                    transferId: 101n,
                    pendingRef: "fx_execute:doc-fx-1:source",
                    amountMinor: 10_000n,
                  },
                ]),
              })),
            };
          }

          throw new Error("unexpected table");
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{}]),
          })),
        })),
      })),
    };
    const deps = createIfrsDocumentDeps({
      currenciesService: {
        findById: vi.fn(async (id: string) => {
          if (id === "cur-usd") return { id, code: "USD", precision: 2 };
          if (id === "cur-eur") return { id, code: "EUR", precision: 2 };
          throw new Error(`Unknown currency ${id}`);
        }),
      } as any,
      fxService: {
        quote: vi.fn(async () => ({
          ...quote,
          fromCurrency: "USD",
          toCurrency: "EUR",
        })),
      } as any,
      requisitesService: {
        resolveBindings: vi.fn(async () => []),
        findById: vi.fn(),
      } as any,
    });

    await expect(
      deps.treasuryFxQuote.createQuoteSnapshot({
        db: db as any,
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "10000",
        asOf: new Date("2026-03-03T10:00:00.000Z"),
        idempotencyKey: "documents.fx_execute.quote:create-idem",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        quoteId: quote.id,
        fromCurrency: "USD",
        toCurrency: "EUR",
      }),
    );
    await expect(
      deps.treasuryFxQuote.loadQuoteSnapshotById({
        db: db as any,
        quoteId: quote.id,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        quoteId: quote.id,
        idempotencyKey: "quote-ref-1",
      }),
    );
    await expect(
      deps.fxExecuteLookup.resolveFxExecuteDependencyDocument({
        db: db as any,
        fxExecuteDocumentId: "doc-fx-1",
      }),
    ).resolves.toEqual(dependencyDocument);
    await expect(
      deps.fxExecuteLookup.listPendingTransfers({
        db: db as any,
        fxExecuteDocumentId: "doc-fx-1",
      }),
    ).resolves.toEqual([
      {
        transferId: 101n,
        pendingRef: "fx_execute:doc-fx-1:source",
        amountMinor: 10_000n,
      },
    ]);
    await expect(
      deps.quoteUsage.markQuoteUsedForFxExecute({
        db: db as any,
        quoteId: quote.id,
        fxExecuteDocumentId: "doc-fx-1",
        at: new Date("2026-03-03T10:05:00.000Z"),
      }),
    ).resolves.toBeUndefined();
  });
});
