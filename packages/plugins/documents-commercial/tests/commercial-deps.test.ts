import { describe, expect, it, vi } from "vitest";

import { createCommercialDocumentDeps } from "../src";

describe("commercial document deps", () => {
  it("resolves linked invoice totals from accepted quote sell-side pricing", async () => {
    const quoteId = "550e8400-e29b-41d4-a716-446655440010";
    const deps = createCommercialDocumentDeps({
      currenciesService: {
        findByCode: vi.fn(async (code: string) => ({
          code,
          id: `cur-${code.toLowerCase()}`,
          precision: 2,
        })),
      } as any,
      dealReads: {
        findWorkflowById: vi.fn(async () => ({
          acceptedQuote: {
            quoteId,
          },
          executionPlan: [{ kind: "convert" }],
          fundingResolution: {
            state: "resolved",
            strategy: "external_fx",
          },
          summary: {
            calculationId: null,
            type: "payment",
          },
        })),
      },
      documentsReadModel: {
        findBusinessLinkByDocumentId: vi.fn(async () => ({
          dealId: "deal-1",
        })),
      },
      partiesService: {
        counterparties: {
          findById: vi.fn(async (id: string) => ({ id })),
        },
        customers: {
          findById: vi.fn(async (id: string) => ({ id })),
        },
      },
      requisitesService: {
        resolveBindings: vi.fn(async () => []),
      },
      treasuryQuotes: {
        createQuote: vi.fn(),
        getQuoteDetails: vi.fn(async () => ({
          feeComponents: [],
          financialLines: [
            {
              amountMinor: 50n,
              bucket: "commercial_revenue",
              currency: "USD",
              id: "crm:commercial_fee",
              metadata: {},
              memo: "Commercial fee",
              settlementMode: "in_ledger",
              source: "manual",
            },
          ],
          legs: [
            {
              asOf: new Date("2026-04-29T10:00:00.000Z"),
              createdAt: new Date("2026-04-29T10:00:00.000Z"),
              executionCounterpartyId: null,
              fromAmountMinor: 950n,
              fromCurrency: "USD",
              fromCurrencyId: "cur-usd",
              id: "quote-leg-1",
              idx: 1,
              quoteId,
              rateDen: 950n,
              rateNum: 1_000n,
              sourceKind: "manual",
              sourceRef: null,
              toAmountMinor: 1_000n,
              toCurrency: "EUR",
              toCurrencyId: "cur-eur",
            },
          ],
          pricingTrace: {},
          quote: {
            createdAt: new Date("2026-04-29T10:00:00.000Z"),
            dealDirection: null,
            dealForm: null,
            dealId: "deal-1",
            expiresAt: new Date("2026-04-29T11:00:00.000Z"),
            fromAmountMinor: 950n,
            fromCurrency: "USD",
            fromCurrencyId: "cur-usd",
            id: quoteId,
            idempotencyKey: "quote-idem",
            pricingMode: "explicit_route",
            pricingTrace: {
              metadata: {
                crmPricingSnapshot: {
                  clientSide: {
                    clientPrincipalMinor: "950",
                    customerTotalMinor: "1000",
                  },
                },
              },
            },
            rateDen: 950n,
            rateNum: 1_000n,
            status: "active",
            toAmountMinor: 1_000n,
            toCurrency: "EUR",
            toCurrencyId: "cur-eur",
            usedAt: null,
            usedByRef: null,
            usedDocumentId: null,
          },
        })),
        markQuoteUsed: vi.fn(),
      },
    });

    const context = await deps.dealFx.resolveDealFxContext("deal-1");

    expect(context).toMatchObject({
      calculationCurrency: "USD",
      originalAmountMinor: "950",
      totalAmountMinor: "1000",
    });
    expect(context?.financialLines).toEqual([
      expect.objectContaining({
        amountMinor: 50n,
        bucket: "commercial_revenue",
        source: "manual",
      }),
    ]);
  });

  it("does not fall back to calculation totals when accepted quote pricing is unavailable", async () => {
    const quoteId = "550e8400-e29b-41d4-a716-446655440020";
    const deps = createCommercialDocumentDeps({
      currenciesService: {
        findByCode: vi.fn(async (code: string) => ({
          code,
          id: `cur-${code.toLowerCase()}`,
          precision: 2,
        })),
        findById: vi.fn(async (id: string) => ({
          code: id === "cur-usd" ? "USD" : "EUR",
          id,
          precision: 2,
        })),
      } as any,
      dealReads: {
        findWorkflowById: vi.fn(async () => ({
          acceptedQuote: {
            quoteId,
          },
          executionPlan: [{ kind: "convert" }],
          fundingResolution: {
            state: "resolved",
            strategy: "external_fx",
          },
          summary: {
            calculationId: "calc-1",
            type: "payment",
          },
        })),
      },
      treasuryQuotes: {
        createQuote: vi.fn(),
        getQuoteDetails: vi.fn(async () => ({
          feeComponents: [],
          financialLines: [],
          legs: [
            {
              asOf: new Date("2026-04-29T10:00:00.000Z"),
              createdAt: new Date("2026-04-29T10:00:00.000Z"),
              executionCounterpartyId: null,
              fromAmountMinor: 900n,
              fromCurrency: "USD",
              fromCurrencyId: "cur-usd",
              id: "quote-leg-1",
              idx: 1,
              quoteId,
              rateDen: 900n,
              rateNum: 1_000n,
              sourceKind: "manual",
              sourceRef: null,
              toAmountMinor: 1_000n,
              toCurrency: "EUR",
              toCurrencyId: "cur-eur",
            },
          ],
          pricingTrace: {},
          quote: {
            createdAt: new Date("2026-04-29T10:00:00.000Z"),
            dealDirection: null,
            dealForm: null,
            dealId: "deal-1",
            expiresAt: new Date("2026-04-29T11:00:00.000Z"),
            fromAmountMinor: 900n,
            fromCurrency: "USD",
            fromCurrencyId: "cur-usd",
            id: quoteId,
            idempotencyKey: "quote-idem",
            pricingMode: "explicit_route",
            pricingTrace: {},
            rateDen: 900n,
            rateNum: 1_000n,
            status: "active",
            toAmountMinor: 1_000n,
            toCurrency: "EUR",
            toCurrencyId: "cur-eur",
            usedAt: null,
            usedByRef: null,
            usedDocumentId: null,
          },
        })),
        markQuoteUsed: vi.fn(),
      },
    });

    const context = await deps.dealFx.resolveDealFxContext("deal-1");

    expect(context).toMatchObject({
      calculationCurrency: "USD",
      originalAmountMinor: null,
      totalAmountMinor: null,
    });
    expect(context?.financialLines).toEqual([]);
  });

  it("marks invoice quote usage with explicit usedDocumentId", async () => {
    const markQuoteUsed = vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000010",
      status: "used",
    }));

    const deps = createCommercialDocumentDeps({
      currenciesService: {
        findByCode: vi.fn(),
      } as any,
      dealReads: {
        findWorkflowById: vi.fn(async () => null),
      },
      documentsReadModel: {
        findBusinessLinkByDocumentId: vi.fn(async () => null),
      },
      partiesService: {
        counterparties: {
          findById: vi.fn(async () => ({ id: "counterparty-1" })),
        },
        customers: {
          findById: vi.fn(async () => ({ id: "customer-1" })),
        },
      },
      requisitesService: {
        resolveBindings: vi.fn(async () => []),
      },
      treasuryQuotes: {
        createQuote: vi.fn(),
        getQuoteDetails: vi.fn(),
        markQuoteUsed,
      },
    });

    await deps.quoteUsage.markQuoteUsedForInvoice({
      runtime: {} as any,
      quoteId: "00000000-0000-4000-8000-000000000010",
      invoiceDocumentId: "3510af80-077f-4a55-8803-5a330e144a0a",
      at: new Date("2026-04-05T08:35:00.000Z"),
    });

    expect(markQuoteUsed).toHaveBeenCalledWith({
      quoteId: "00000000-0000-4000-8000-000000000010",
      usedByRef: "invoice:3510af80-077f-4a55-8803-5a330e144a0a",
      usedDocumentId: "3510af80-077f-4a55-8803-5a330e144a0a",
      at: new Date("2026-04-05T08:35:00.000Z"),
    });
  });
});
