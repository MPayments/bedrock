import { describe, expect, it, vi } from "vitest";

import { DealQuoteNotAcceptedError } from "@bedrock/deals";

import { createDealQuoteWorkflow } from "../../src/composition/deal-quote-workflow";

function createWorkflow(overrides?: {
  acceptedQuote?: Record<string, unknown> | null;
  appendTimelineEvent?: ReturnType<typeof vi.fn>;
  expireQuotes?: ReturnType<typeof vi.fn>;
  getQuoteDetails?: ReturnType<typeof vi.fn>;
  linkCalculationFromAcceptedQuote?: ReturnType<typeof vi.fn>;
  markQuoteUsed?: ReturnType<typeof vi.fn>;
}) {
  const deals = {
    deals: {
      commands: {
        appendTimelineEvent:
          overrides?.appendTimelineEvent ?? vi.fn(async () => undefined),
        linkCalculationFromAcceptedQuote:
          overrides?.linkCalculationFromAcceptedQuote ??
          vi.fn(async () => undefined),
      },
      queries: {
        findWorkflowById: vi.fn(async () => ({
          acceptedQuote:
            overrides?.acceptedQuote ??
            ({
              acceptedAt: new Date("2026-04-01T10:00:00.000Z"),
              acceptedByUserId: "user-1",
              agreementVersionId: null,
              dealId: "deal-1",
              dealRevision: 2,
              expiresAt: new Date("2099-04-01T11:00:00.000Z"),
              id: "acceptance-1",
              quoteId: "quote-1",
              quoteStatus: "active",
              replacedByQuoteId: null,
              revokedAt: null,
              usedAt: null,
              usedDocumentId: null,
            } as const),
          revision: 2,
        })),
      },
    },
  };
  const calculations = {
    calculations: {
      commands: {
        create: vi.fn(async () => ({
          id: "calculation-1",
        })),
      },
    },
  };
  const currencies = {
    findByCode: vi.fn(async (code: string) => ({
      code,
      id: `cur-${code.toLowerCase()}`,
      precision: 2,
    })),
  };
  const treasury = {
    quotes: {
      commands: {
        expireQuotes:
          overrides?.expireQuotes ??
          vi.fn(async () => [
            {
              createdAt: new Date("2026-04-01T09:00:00.000Z"),
              dealDirection: null,
              dealForm: null,
              dealId: "deal-1",
              expiresAt: new Date("2026-04-01T10:00:00.000Z"),
              fromAmountMinor: 10000n,
              fromCurrencyId: "cur-usd",
              id: "quote-1",
              idempotencyKey: "quote-1",
              pricingMode: "auto_cross",
              pricingTrace: {},
              rateDen: 10n,
              rateNum: 9n,
              status: "expired",
              toAmountMinor: 9000n,
              toCurrencyId: "cur-eur",
              usedAt: null,
              usedByRef: null,
              usedDocumentId: null,
            },
          ]),
        markQuoteUsed:
          overrides?.markQuoteUsed ??
          vi.fn(async (input: { dealId?: string | null; quoteId: string; usedByRef: string; usedDocumentId?: string | null; at: Date }) => ({
            createdAt: new Date("2026-04-01T09:00:00.000Z"),
            dealDirection: null,
            dealForm: null,
            dealId: input.dealId ?? "deal-1",
            expiresAt: new Date("2099-04-01T11:00:00.000Z"),
            fromAmountMinor: 10000n,
            fromCurrencyId: "cur-usd",
            id: input.quoteId,
            idempotencyKey: "quote-1",
            pricingMode: "auto_cross",
            pricingTrace: {},
            rateDen: 10n,
            rateNum: 9n,
            status: "used",
            toAmountMinor: 9000n,
            toCurrencyId: "cur-eur",
            usedAt: input.at,
            usedByRef: input.usedByRef,
            usedDocumentId: input.usedDocumentId ?? null,
          })),
      },
      queries: {
        getQuoteDetails:
          overrides?.getQuoteDetails ??
          vi.fn(async () => ({
            feeComponents: [],
            financialLines: [
              {
                amountMinor: 100n,
                bucket: "fee_revenue",
                currency: "USD",
                source: "rule",
              },
              {
                amountMinor: 50n,
                bucket: "pass_through",
                currency: "EUR",
                source: "rule",
              },
            ],
            legs: [],
            pricingTrace: {},
            quote: {
              createdAt: new Date("2026-04-01T10:00:00.000Z"),
              dealDirection: null,
              dealForm: null,
              dealId: "deal-1",
              expiresAt: new Date("2099-04-01T11:00:00.000Z"),
              fromAmountMinor: 10000n,
              fromCurrency: "USD",
              fromCurrencyId: "cur-usd",
              id: "quote-1",
              idempotencyKey: "quote-1",
              pricingMode: "auto_cross",
              pricingTrace: {},
              rateDen: 10n,
              rateNum: 9n,
              status: "active",
              toAmountMinor: 9000n,
              toCurrency: "EUR",
              toCurrencyId: "cur-eur",
              usedAt: null,
              usedByRef: null,
              usedDocumentId: null,
            },
          })),
      },
    },
  };

  return {
    calculations,
    currencies,
    deals,
    treasury,
    workflow: createDealQuoteWorkflow({
      calculations: calculations as any,
      currencies: currencies as any,
      deals: deals as any,
      treasury: treasury as any,
    }),
  };
}

describe("deal quote workflow", () => {
  it("rejects quote usage when the quote is not the current accepted quote", async () => {
    const { treasury, workflow } = createWorkflow({
      acceptedQuote: {
        acceptedAt: new Date("2026-04-01T10:00:00.000Z"),
        acceptedByUserId: "user-1",
        agreementVersionId: null,
        dealId: "deal-1",
        dealRevision: 2,
        expiresAt: new Date("2099-04-01T11:00:00.000Z"),
        id: "acceptance-1",
        quoteId: "quote-2",
        quoteStatus: "active",
        replacedByQuoteId: null,
        revokedAt: null,
        usedAt: null,
        usedDocumentId: null,
      },
    });

    await expect(
      workflow.markQuoteUsed({
        at: new Date("2026-04-01T10:05:00.000Z"),
        dealId: "deal-1",
        quoteId: "quote-1",
        usedByRef: "fx_execute:doc-1",
      }),
    ).rejects.toBeInstanceOf(DealQuoteNotAcceptedError);

    expect(treasury.quotes.commands.markQuoteUsed).not.toHaveBeenCalled();
  });

  it("appends quote_used after successful treasury execution", async () => {
    const appendTimelineEvent = vi.fn(async () => undefined);
    const { deals, workflow } = createWorkflow({
      appendTimelineEvent,
    });

    await workflow.markQuoteUsed({
      at: new Date("2026-04-01T10:05:00.000Z"),
      dealId: "deal-1",
      quoteId: "quote-1",
      usedByRef: "fx_execute:doc-1",
      usedDocumentId: "doc-1",
    });

    expect(deals.deals.commands.appendTimelineEvent).toHaveBeenCalledWith({
      dealId: "deal-1",
      payload: {
        quoteId: "quote-1",
        usedAt: new Date("2026-04-01T10:05:00.000Z"),
        usedByRef: "fx_execute:doc-1",
        usedDocumentId: "doc-1",
      },
      sourceRef: "quote:quote-1:used:fx_execute:doc-1",
      type: "quote_used",
      visibility: "internal",
    });
  });

  it("appends quote_expired for linked deal quotes", async () => {
    const appendTimelineEvent = vi.fn(async () => undefined);
    const expireQuotes = vi.fn(async () => [
      {
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        dealDirection: null,
        dealForm: null,
        dealId: "deal-1",
        expiresAt: new Date("2026-04-01T10:00:00.000Z"),
        fromAmountMinor: 10000n,
        fromCurrencyId: "cur-usd",
        id: "quote-1",
        idempotencyKey: "quote-1",
        pricingMode: "auto_cross",
        pricingTrace: {},
        rateDen: 10n,
        rateNum: 9n,
        status: "expired",
        toAmountMinor: 9000n,
        toCurrencyId: "cur-eur",
        usedAt: null,
        usedByRef: null,
        usedDocumentId: null,
      },
      {
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        dealDirection: null,
        dealForm: null,
        dealId: null,
        expiresAt: new Date("2026-04-01T10:00:00.000Z"),
        fromAmountMinor: 10000n,
        fromCurrencyId: "cur-usd",
        id: "quote-2",
        idempotencyKey: "quote-2",
        pricingMode: "auto_cross",
        pricingTrace: {},
        rateDen: 10n,
        rateNum: 9n,
        status: "expired",
        toAmountMinor: 9000n,
        toCurrencyId: "cur-eur",
        usedAt: null,
        usedByRef: null,
        usedDocumentId: null,
      },
    ]);
    const { deals, workflow } = createWorkflow({
      appendTimelineEvent,
      expireQuotes,
    });

    await workflow.expireQuotes(new Date("2026-04-01T10:01:00.000Z"));

    expect(deals.deals.commands.appendTimelineEvent).toHaveBeenCalledTimes(1);
    expect(deals.deals.commands.appendTimelineEvent).toHaveBeenCalledWith({
      dealId: "deal-1",
      payload: {
        expiresAt: new Date("2026-04-01T10:00:00.000Z"),
        quoteId: "quote-1",
      },
      sourceRef: "quote:quote-1:expired",
      type: "quote_expired",
      visibility: "internal",
    });
  });

  it("creates a calculation from the current accepted quote and links it to the deal", async () => {
    const linkCalculationFromAcceptedQuote = vi.fn(async () => undefined);
    const { calculations, deals, workflow } = createWorkflow({
      linkCalculationFromAcceptedQuote,
    });

    const calculation = await workflow.createCalculationFromAcceptedQuote({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
      quoteId: "quote-1",
    });

    expect(calculations.calculations.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        baseCurrencyId: "cur-eur",
        calculationCurrencyId: "cur-usd",
        fxQuoteId: "quote-1",
        idempotencyKey: "idem-1",
        rateSource: "fx_quote",
      }),
    );
    expect(deals.deals.commands.linkCalculationFromAcceptedQuote).toHaveBeenCalledWith(
      {
        actorUserId: "user-1",
        calculationId: "calculation-1",
        dealId: "deal-1",
        quoteId: "quote-1",
      },
    );
    expect(calculation).toEqual({ id: "calculation-1" });
  });
});
