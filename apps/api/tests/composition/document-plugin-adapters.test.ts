import { describe, expect, it, vi } from "vitest";

import type { DocumentModuleRuntime } from "@bedrock/plugin-documents-sdk";

import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "../../src/composition/document-plugin-adapters";

function createRuntime(input: {
  getDocumentByType?: DocumentModuleRuntime["documents"]["getDocumentByType"];
  getDocumentOperationId?: DocumentModuleRuntime["documents"]["getDocumentOperationId"];
}): DocumentModuleRuntime {
  return {
    documents: {
      findIncomingLinkedDocument: vi.fn(async () => null),
      getDocumentByType: input.getDocumentByType ?? vi.fn(async () => null),
      getDocumentOperationId:
        input.getDocumentOperationId ?? vi.fn(async () => null),
    },
    withQueryable: (run) => run({}),
  };
}

describe("document plugin adapters composition", () => {
  it("builds commercial quote snapshots from FX and currency services", async () => {
    const fxQuotes = {
      quote: vi.fn(async () => ({
        id: "550e8400-e29b-41d4-a716-446655440010",
      })),
      getQuoteDetails: vi.fn(async () => ({
        quote: {
          id: "550e8400-e29b-41d4-a716-446655440010",
          fromCurrencyId: "cur-usd",
          toCurrencyId: "cur-usdt",
          fromCurrency: "USD",
          toCurrency: "USDT",
          fromAmountMinor: 10_000n,
          toAmountMinor: 123_456n,
          pricingMode: "explicit_route",
          pricingTrace: { version: "v1", mode: "explicit_route" },
          dealDirection: null,
          dealForm: null,
          rateNum: 15432n,
          rateDen: 1250n,
          status: "active",
          usedByRef: null,
          usedAt: null,
          expiresAt: new Date("2026-03-03T10:10:00.000Z"),
          idempotencyKey: "quote-ref-crypto",
          createdAt: new Date("2026-03-03T10:00:00.000Z"),
        },
        legs: [
          {
            id: "leg_1",
            quoteId: "550e8400-e29b-41d4-a716-446655440010",
            idx: 1,
            fromCurrencyId: "cur-usd",
            toCurrencyId: "cur-usdt",
            fromCurrency: "USD",
            toCurrency: "USDT",
            fromAmountMinor: 10_000n,
            toAmountMinor: 123_456n,
            rateNum: 15432n,
            rateDen: 1250n,
            sourceKind: "manual",
            sourceRef: "desk",
            asOf: new Date("2026-03-03T10:00:00.000Z"),
            executionCounterpartyId: null,
            createdAt: new Date("2026-03-03T10:00:00.000Z"),
          },
        ],
        feeComponents: [],
        financialLines: [
          {
            id: "quote_financial_line:1",
            bucket: "fee_revenue",
            currency: "USDT",
            amountMinor: 123_456n,
            source: "rule",
            settlementMode: "in_ledger",
            memo: undefined,
            metadata: undefined,
          },
        ],
        pricingTrace: { version: "v1", mode: "explicit_route" },
      })),
      markQuoteUsed: vi.fn(),
    };
    const currenciesService = {
      findByCode: vi.fn(async (code: string) => {
        if (code === "USD") {
          return { id: "cur-usd", code, precision: 2 };
        }
        if (code === "USDT") {
          return { id: "cur-usdt", code, precision: 6 };
        }

        throw new Error(`Unknown currency ${code}`);
      }),
    };
    const requisitesService = {
      resolveBindings: vi.fn(async () => []),
      findById: vi.fn(),
    };
    const partiesService = {
      customers: {
        findById: vi.fn(async (id: string) => ({ id })),
      },
      counterparties: {
        findById: vi.fn(async (id: string) => ({ id })),
      },
    };

    const deps = createCommercialDocumentDeps({
      currenciesService: currenciesService as any,
      fxQuotes: fxQuotes as any,
      partiesService: partiesService as any,
      requisitesService: requisitesService as any,
    });

    const snapshot = await deps.quoteSnapshot.loadQuoteSnapshot({
      runtime: createRuntime({}),
      quoteRef: "quote-ref-crypto",
    });

    expect(snapshot.financialLines).toEqual([
      expect.objectContaining({
        currency: "USDT",
        amount: "0.123456",
        amountMinor: "123456",
      }),
    ]);
    expect(fxQuotes.getQuoteDetails).toHaveBeenCalledWith({
      quoteRef: "quote-ref-crypto",
    });

    await expect(
      deps.quoteSnapshot.createQuoteSnapshot({
        runtime: createRuntime({}),
        fromCurrency: "USD",
        toCurrency: "USDT",
        fromAmountMinor: "10000",
        asOf: new Date("2026-03-03T10:00:00.000Z"),
        idempotencyKey: "documents.invoice.exchange.quote:create-idem",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        quoteId: "550e8400-e29b-41d4-a716-446655440010",
        quoteRef: "550e8400-e29b-41d4-a716-446655440010",
      }),
    );
  });

  it("builds IFRS transfer lookup adapters from owner BC query ports", async () => {
    const dependencyDocument = {
      id: "doc-transfer-1",
      docType: "transfer_intra",
      payload: { amountMinor: "1000" },
      occurredAt: new Date("2026-03-04T10:00:00.000Z"),
    };
    const ledgerReadService = {
      getOperationDetails: vi.fn(async () => ({
        operation: {} as any,
        postings: [],
        tbPlans: [
          {
            id: "plan_1",
            lineNo: 1,
            type: "post_pending",
            transferId: 1n,
            debitTbAccountId: null,
            creditTbAccountId: null,
            tbLedger: 1,
            amount: 1000n,
            code: 0,
            pendingRef: "pending-1",
            pendingId: null,
            isLinked: false,
            isPending: true,
            timeoutSeconds: 3600,
            status: "pending",
            error: null,
            createdAt: new Date("2026-03-04T10:00:00.000Z"),
          },
        ],
      })),
    };
    const deps = createIfrsDocumentDeps({
      currenciesService: {
        findByCode: vi.fn(),
      } as any,
      fxQuotes: {
        getQuoteDetails: vi.fn(),
        markQuoteUsed: vi.fn(),
        quote: vi.fn(),
      } as any,
      ledgerReadService: ledgerReadService as any,
      requisitesService: {
        resolveBindings: vi.fn(async () => []),
        findById: vi.fn(),
      } as any,
    });
    const runtime = createRuntime({
      getDocumentByType: vi.fn(async () => dependencyDocument),
      getDocumentOperationId: vi.fn(async () => "op-transfer-1"),
    });

    await expect(
      deps.transferLookup.resolveTransferDependencyDocument({
        runtime,
        transferDocumentId: "doc-transfer-1",
      }),
    ).resolves.toEqual(dependencyDocument);
    await expect(
      deps.transferLookup.listPendingTransfers({
        runtime,
        transferDocumentId: "doc-transfer-1",
      }),
    ).resolves.toEqual([
      {
        transferId: 1n,
        pendingRef: "pending-1",
        amountMinor: 1000n,
      },
    ]);
  });

  it("builds IFRS FX quote and quote-usage adapters from owner BC services", async () => {
    const quoteId = "550e8400-e29b-41d4-a716-446655440099";
    const fxQuotes = {
      getQuoteDetails: vi.fn(async () => ({
        quote: {
          id: quoteId,
          fromCurrencyId: "cur-usd",
          toCurrencyId: "cur-eur",
          fromCurrency: "USD",
          toCurrency: "EUR",
          fromAmountMinor: 10_000n,
          toAmountMinor: 9_200n,
          pricingMode: "explicit_route",
          pricingTrace: { version: "v1", mode: "explicit_route" },
          dealDirection: null,
          dealForm: null,
          rateNum: 23n,
          rateDen: 25n,
          status: "active",
          usedByRef: null,
          usedAt: null,
          expiresAt: new Date("2026-03-03T10:10:00.000Z"),
          idempotencyKey: "quote-ref-1",
          createdAt: new Date("2026-03-03T10:00:00.000Z"),
        },
        legs: [
          {
            id: "leg_1",
            quoteId,
            idx: 1,
            fromCurrencyId: "cur-usd",
            toCurrencyId: "cur-eur",
            fromCurrency: "USD",
            toCurrency: "EUR",
            fromAmountMinor: 10_000n,
            toAmountMinor: 9_200n,
            rateNum: 23n,
            rateDen: 25n,
            sourceKind: "manual",
            sourceRef: "desk",
            asOf: new Date("2026-03-03T10:00:00.000Z"),
            executionCounterpartyId: null,
            createdAt: new Date("2026-03-03T10:00:00.000Z"),
          },
        ],
        feeComponents: [],
        financialLines: [],
        pricingTrace: { version: "v1", mode: "explicit_route" },
      })),
      markQuoteUsed: vi.fn(async () => ({
        id: quoteId,
      })),
      quote: vi.fn(async () => ({
        id: quoteId,
      })),
    };
    const ledgerReadService = {
      getOperationDetails: vi.fn(async () => ({
        operation: {} as any,
        postings: [],
        tbPlans: [
          {
            id: "plan_1",
            lineNo: 1,
            type: "post_pending",
            transferId: 101n,
            debitTbAccountId: null,
            creditTbAccountId: null,
            tbLedger: 1,
            amount: 10_000n,
            code: 0,
            pendingRef: "fx_execute:doc-fx-1:source",
            pendingId: null,
            isLinked: false,
            isPending: true,
            timeoutSeconds: 3600,
            status: "pending",
            error: null,
            createdAt: new Date("2026-03-03T10:00:00.000Z"),
          },
        ],
      })),
    };
    const dependencyDocument = {
      id: "doc-fx-1",
      docType: "fx_execute",
      payload: { quoteRef: "quote-ref-1" },
      occurredAt: new Date("2026-03-03T10:00:00.000Z"),
    };
    const deps = createIfrsDocumentDeps({
      currenciesService: {
        findByCode: vi.fn(async (code: string) => {
          if (code === "USD") return { id: "cur-usd", code, precision: 2 };
          if (code === "EUR") return { id: "cur-eur", code, precision: 2 };
          throw new Error(`Unknown currency ${code}`);
        }),
      } as any,
      fxQuotes: fxQuotes as any,
      ledgerReadService: ledgerReadService as any,
      requisitesService: {
        resolveBindings: vi.fn(async () => []),
        findById: vi.fn(),
      } as any,
    });
    const runtime = createRuntime({
      getDocumentByType: vi.fn(async () => dependencyDocument),
      getDocumentOperationId: vi.fn(async () => "op-fx-1"),
    });

    await expect(
      deps.treasuryFxQuote.createQuoteSnapshot({
        runtime,
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "10000",
        asOf: new Date("2026-03-03T10:00:00.000Z"),
        idempotencyKey: "documents.fx_execute.quote:create-idem",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        quoteId,
        fromCurrency: "USD",
        toCurrency: "EUR",
      }),
    );
    await expect(
      deps.treasuryFxQuote.loadQuoteSnapshotById({
        runtime,
        quoteId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        quoteId,
        idempotencyKey: "quote-ref-1",
      }),
    );
    await expect(
      deps.fxExecuteLookup.resolveFxExecuteDependencyDocument({
        runtime,
        fxExecuteDocumentId: "doc-fx-1",
      }),
    ).resolves.toEqual(dependencyDocument);
    await expect(
      deps.fxExecuteLookup.listPendingTransfers({
        runtime,
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
        runtime,
        quoteId,
        fxExecuteDocumentId: "doc-fx-1",
        at: new Date("2026-03-03T10:05:00.000Z"),
      }),
    ).resolves.toBeUndefined();
    expect(fxQuotes.markQuoteUsed).toHaveBeenCalledWith({
      quoteId,
      usedByRef: "fx_execute:doc-fx-1",
      at: new Date("2026-03-03T10:05:00.000Z"),
    });
  });
});
