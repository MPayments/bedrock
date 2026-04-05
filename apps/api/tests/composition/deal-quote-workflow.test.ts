import { describe, expect, it, vi } from "vitest";

import { DealQuoteNotAcceptedError } from "@bedrock/deals";

import { createDealQuoteWorkflow } from "../../src/composition/deal-quote-workflow";

function createWorkflow(overrides?: {
  acceptedQuote?: Record<string, unknown> | null;
  agreement?: Record<string, unknown>;
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
          summary: {
            agreementId: "agreement-1",
          },
          revision: 2,
        })),
      },
    },
  };
  const agreements = {
    agreements: {
      queries: {
        findById: vi.fn(async () => ({
          id: "agreement-1",
          customerId: "customer-1",
          organizationId: "organization-1",
          organizationRequisiteId: "requisite-1",
          isActive: true,
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          currentVersion: {
            id: "agreement-version-1",
            versionNumber: 1,
            contractNumber: null,
            contractDate: null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            parties: [],
            feeRules: [],
            ...overrides?.agreement,
          },
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
    findById: vi.fn(async (id: string) => ({
      code: id.replace(/^cur-/u, "").toUpperCase(),
      id,
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
    agreements,
    calculations,
    currencies,
    deals,
    treasury,
    workflow: createDealQuoteWorkflow({
      agreements: agreements as any,
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

  it("allows idempotent markQuoteUsed when the accepted quote is already used by the same document", async () => {
    const appendTimelineEvent = vi.fn(async () => undefined);
    const { deals, treasury, workflow } = createWorkflow({
      acceptedQuote: {
        acceptedAt: new Date("2026-04-01T10:00:00.000Z"),
        acceptedByUserId: "user-1",
        agreementVersionId: null,
        dealId: "deal-1",
        dealRevision: 2,
        expiresAt: new Date("2099-04-01T11:00:00.000Z"),
        id: "acceptance-1",
        quoteId: "quote-1",
        quoteStatus: "used",
        replacedByQuoteId: null,
        revokedAt: null,
        usedAt: new Date("2026-04-01T10:05:00.000Z"),
        usedDocumentId: "doc-1",
      },
      appendTimelineEvent,
    });

    await expect(
      workflow.markQuoteUsed({
        at: new Date("2026-04-01T10:06:00.000Z"),
        dealId: "deal-1",
        quoteId: "quote-1",
        usedByRef: "invoice:doc-1",
        usedDocumentId: "doc-1",
      }),
    ).resolves.toMatchObject({
      id: "quote-1",
      status: "used",
      usedDocumentId: "doc-1",
    });

    expect(treasury.quotes.commands.markQuoteUsed).toHaveBeenCalledWith({
      at: new Date("2026-04-01T10:06:00.000Z"),
      dealId: "deal-1",
      quoteId: "quote-1",
      usedByRef: "invoice:doc-1",
      usedDocumentId: "doc-1",
    });
    expect(deals.deals.commands.appendTimelineEvent).toHaveBeenCalledWith({
      dealId: "deal-1",
      payload: {
        quoteId: "quote-1",
        usedAt: new Date("2026-04-01T10:06:00.000Z"),
        usedByRef: "invoice:doc-1",
        usedDocumentId: "doc-1",
      },
      sourceRef: "quote:quote-1:used:invoice:doc-1",
      type: "quote_used",
      visibility: "internal",
    });
  });

  it("still rejects markQuoteUsed when the accepted quote is already used by another document", async () => {
    const { treasury, workflow } = createWorkflow({
      acceptedQuote: {
        acceptedAt: new Date("2026-04-01T10:00:00.000Z"),
        acceptedByUserId: "user-1",
        agreementVersionId: null,
        dealId: "deal-1",
        dealRevision: 2,
        expiresAt: new Date("2099-04-01T11:00:00.000Z"),
        id: "acceptance-1",
        quoteId: "quote-1",
        quoteStatus: "used",
        replacedByQuoteId: null,
        revokedAt: null,
        usedAt: new Date("2026-04-01T10:05:00.000Z"),
        usedDocumentId: "doc-2",
      },
    });

    await expect(
      workflow.markQuoteUsed({
        at: new Date("2026-04-01T10:06:00.000Z"),
        dealId: "deal-1",
        quoteId: "quote-1",
        usedByRef: "invoice:doc-1",
        usedDocumentId: "doc-1",
      }),
    ).rejects.toThrow("Quote quote-1 is not active: used");

    expect(treasury.quotes.commands.markQuoteUsed).not.toHaveBeenCalled();
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

  it("applies active agreement fee defaults when creating a calculation", async () => {
    const { calculations, workflow } = createWorkflow({
      agreement: {
        feeRules: [
          {
            id: "rule-agent-fee",
            kind: "agent_fee",
            unit: "bps",
            value: "100",
            currencyId: null,
            currencyCode: null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
          {
            id: "rule-fixed-fee",
            kind: "fixed_fee",
            unit: "money",
            value: "150",
            currencyId: "cur-eur",
            currencyCode: "EUR",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
      },
    });

    await workflow.createCalculationFromAcceptedQuote({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
      quoteId: "quote-1",
    });

    expect(calculations.calculations.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalExpensesAmountMinor: "15050",
        additionalExpensesCurrencyId: "cur-eur",
        additionalExpensesInBaseMinor: "15050",
        feeAmountInBaseMinor: "180",
        feeAmountMinor: "200",
        feeBps: "200",
        totalAmountMinor: "10200",
        totalWithExpensesInBaseMinor: "24230",
      }),
    );
  });

  it("allows clearing agreement fee defaults explicitly", async () => {
    const { calculations, workflow } = createWorkflow({
      agreement: {
        feeRules: [
          {
            id: "rule-agent-fee",
            kind: "agent_fee",
            unit: "bps",
            value: "100",
            currencyId: null,
            currencyCode: null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
          {
            id: "rule-fixed-fee",
            kind: "fixed_fee",
            unit: "money",
            value: "150",
            currencyId: "cur-eur",
            currencyCode: "EUR",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
      },
    });

    await workflow.createCalculationFromAcceptedQuote({
      actorUserId: "user-1",
      agentFeePercent: null,
      dealId: "deal-1",
      fixedFeeAmount: null,
      idempotencyKey: "idem-1",
      quoteId: "quote-1",
    });

    expect(calculations.calculations.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalExpensesAmountMinor: "50",
        additionalExpensesCurrencyId: "cur-eur",
        additionalExpensesInBaseMinor: "50",
        feeAmountInBaseMinor: "90",
        feeAmountMinor: "100",
        feeBps: "100",
        totalAmountMinor: "10100",
        totalWithExpensesInBaseMinor: "9140",
      }),
    );
  });

  it("rounds fee bps instead of truncating when the fee amount lands between bps", async () => {
    const getQuoteDetails = vi.fn(async () => ({
      feeComponents: [],
      financialLines: [],
      legs: [],
      pricingTrace: {},
      quote: {
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        dealDirection: null,
        dealForm: null,
        dealId: "deal-1",
        expiresAt: new Date("2099-04-01T11:00:00.000Z"),
        fromAmountMinor: 255133760n,
        fromCurrency: "RUB",
        fromCurrencyId: "cur-rub",
        id: "quote-1",
        idempotencyKey: "quote-1",
        pricingMode: "auto_cross",
        pricingTrace: {},
        rateDen: 1000000n,
        rateNum: 12542n,
        status: "active",
        toAmountMinor: 3200000n,
        toCurrency: "USD",
        toCurrencyId: "cur-usd",
        usedAt: null,
        usedByRef: null,
        usedDocumentId: null,
      },
    }));
    const { calculations, workflow } = createWorkflow({
      agreement: {
        feeRules: [
          {
            id: "rule-agent-fee",
            kind: "agent_fee",
            unit: "bps",
            value: "100",
            currencyId: null,
            currencyCode: null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
      },
      getQuoteDetails,
    });

    await workflow.createCalculationFromAcceptedQuote({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
      quoteId: "quote-1",
    });

    expect(calculations.calculations.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        feeAmountInBaseMinor: "31999",
        feeAmountMinor: "2551338",
        feeBps: "100",
        totalAmountMinor: "257685098",
      }),
    );
  });

  it("rounds percentage fees and converted components with half-up minor-unit policy", async () => {
    const getQuoteDetails = vi.fn(async () => ({
      feeComponents: [],
      financialLines: [],
      legs: [],
      pricingTrace: {},
      quote: {
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        dealDirection: null,
        dealForm: null,
        dealId: "deal-1",
        expiresAt: new Date("2099-04-01T11:00:00.000Z"),
        fromAmountMinor: 50n,
        fromCurrency: "USD",
        fromCurrencyId: "cur-usd",
        id: "quote-1",
        idempotencyKey: "quote-1",
        pricingMode: "auto_cross",
        pricingTrace: {},
        rateDen: 2n,
        rateNum: 1n,
        status: "active",
        toAmountMinor: 25n,
        toCurrency: "EUR",
        toCurrencyId: "cur-eur",
        usedAt: null,
        usedByRef: null,
        usedDocumentId: null,
      },
    }));
    const { calculations, workflow } = createWorkflow({
      agreement: {
        feeRules: [
          {
            id: "rule-agent-fee",
            kind: "agent_fee",
            unit: "bps",
            value: "100",
            currencyId: null,
            currencyCode: null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
        ],
      },
      getQuoteDetails,
    });

    await workflow.createCalculationFromAcceptedQuote({
      actorUserId: "user-1",
      dealId: "deal-1",
      fixedFeeAmount: "0.01",
      fixedFeeCurrencyCode: "USD",
      idempotencyKey: "idem-1",
      quoteId: "quote-1",
    });

    expect(calculations.calculations.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalExpensesAmountMinor: "1",
        additionalExpensesCurrencyId: "cur-usd",
        additionalExpensesInBaseMinor: "1",
        feeAmountInBaseMinor: "1",
        feeAmountMinor: "1",
        totalAmountMinor: "51",
        totalWithExpensesInBaseMinor: "27",
      }),
    );
  });
});
