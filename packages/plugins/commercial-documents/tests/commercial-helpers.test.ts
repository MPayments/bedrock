import { describe, expect, it, vi } from "vitest";

import { POSTING_TEMPLATE_KEY } from "@bedrock/accounting/posting-contracts";

import {
  buildExchangeInvoicePostingPlan,
  buildExchangePostingPlan,
  buildFinancialLineRequests,
  buildQuoteSnapshotHash,
  loadQuoteSnapshot,
  markQuoteUsedForInvoice,
} from "../src/documents/internal/helpers";

function makeQuoteSnapshot(financialLines: any[]) {
  const snapshot = {
    quoteId: "00000000-0000-4000-8000-000000000010",
    quoteRef: "quote-ref-1",
    idempotencyKey: "quote-ref-1",
    fromCurrency: "USD",
    toCurrency: "EUR",
    fromAmountMinor: "10000",
    toAmountMinor: "9200",
    pricingMode: "explicit_route" as const,
    rateNum: "23",
    rateDen: "25",
    expiresAt: "2026-03-03T10:10:00.000Z",
    pricingTrace: { version: "v1", mode: "explicit_route" },
    legs: [
      {
        idx: 1,
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: "10000",
        toAmountMinor: "9200",
        rateNum: "23",
        rateDen: "25",
        sourceKind: "manual" as const,
        sourceRef: "desk",
        asOf: "2026-03-03T10:00:00.000Z",
        executionCounterpartyId: null,
      },
    ],
    financialLines,
  };

  return {
    ...snapshot,
    snapshotHash: buildQuoteSnapshotHash(snapshot),
  };
}

describe("commercial document helpers", () => {
  it("builds a deterministic quote snapshot hash", () => {
    const snapshot = makeQuoteSnapshot([
      {
        id: "line-1",
        bucket: "fee_revenue" as const,
        currency: "USD",
        amount: "25",
        amountMinor: "2500",
        source: "rule" as const,
        settlementMode: "in_ledger" as const,
      },
    ]);

    const first = buildQuoteSnapshotHash({
      ...snapshot,
      snapshotHash: undefined,
    } as any);
    const second = buildQuoteSnapshotHash({
      ...snapshot,
      snapshotHash: undefined,
      pricingTrace: { version: "v1", mode: "explicit_route" },
    } as any);
    const changed = buildQuoteSnapshotHash({
      ...snapshot,
      snapshotHash: undefined,
      financialLines: [
        {
          ...snapshot.financialLines[0]!,
          amountMinor: "2600",
        },
      ],
    } as any);

    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });

  it("maps signed financial lines to posting templates for direct documents", () => {
    const requests = buildFinancialLineRequests({
      document: {
        id: "doc-1",
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
      } as any,
      bookId: "book-1",
      customerId: "customer-1",
      orderId: "order-1",
      counterpartyId: "counterparty-1",
      quoteRef: "quote-ref-1",
      chainId: "invoice:order-1",
      postingPhase: "direct",
      includeCustomerLines: true,
      includeProviderLines: true,
      lines: [
        {
          id: "fee-positive",
          bucket: "fee_revenue",
          currency: "USD",
          amountMinor: 150n,
          source: "manual",
        },
        {
          id: "spread-negative",
          bucket: "spread_revenue",
          currency: "USD",
          amountMinor: -25n,
          source: "manual",
        },
        {
          id: "provider-negative",
          bucket: "provider_fee_expense",
          currency: "USD",
          amountMinor: -10n,
          source: "manual",
        },
        {
          id: "pass-through-positive",
          bucket: "pass_through",
          currency: "USD",
          amountMinor: 40n,
          source: "manual",
        },
        {
          id: "adjustment-positive",
          bucket: "adjustment",
          currency: "USD",
          amountMinor: 7n,
          source: "manual",
        },
      ],
    });

    expect(
      requests.map((request) => ({
        templateKey: request.templateKey,
        amountMinor: request.amountMinor,
      })),
    ).toEqual([
      {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME,
        amountMinor: 150n,
      },
      {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND,
        amountMinor: 25n,
      },
      {
        templateKey:
          POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE_REVERSAL,
        amountMinor: 10n,
      },
      {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
        amountMinor: 40n,
      },
      {
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE,
        amountMinor: 7n,
      },
    ]);
  });

  it("filters customer-facing and provider-facing lines independently", () => {
    const lines = [
      {
        id: "fee-positive",
        bucket: "fee_revenue" as const,
        currency: "USD",
        amountMinor: 150n,
        source: "manual" as const,
      },
      {
        id: "provider-positive",
        bucket: "provider_fee_expense" as const,
        currency: "USD",
        amountMinor: 30n,
        source: "manual" as const,
      },
    ];

    const customerOnly = buildFinancialLineRequests({
      document: {
        id: "doc-1",
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
      } as any,
      bookId: "book-1",
      customerId: "customer-1",
      orderId: "order-1",
      counterpartyId: "counterparty-1",
      quoteRef: "quote-ref-1",
      chainId: "invoice:order-1",
      postingPhase: "direct",
      lines,
      includeCustomerLines: true,
      includeProviderLines: false,
    });
    const providerOnly = buildFinancialLineRequests({
      document: {
        id: "doc-1",
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
      } as any,
      bookId: "book-1",
      customerId: "customer-1",
      orderId: "order-1",
      counterpartyId: "counterparty-1",
      quoteRef: "quote-ref-1",
      chainId: "invoice:order-1",
      postingPhase: "direct",
      lines,
      includeCustomerLines: false,
      includeProviderLines: true,
    });

    expect(customerOnly).toHaveLength(1);
    expect(customerOnly[0]?.templateKey).toBe(
      POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME,
    );
    expect(providerOnly).toHaveLength(1);
    expect(providerOnly[0]?.templateKey).toBe(
      POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE,
    );
  });

  it("delegates quote snapshot loading through the injected port", async () => {
    const expectedSnapshot = makeQuoteSnapshot([
      {
        id: "line-1",
        bucket: "fee_revenue",
        currency: "USDT",
        amount: "0.123456",
        amountMinor: "123456",
        source: "rule",
        settlementMode: "in_ledger",
      },
    ]);
    const loadQuoteSnapshotPort = vi.fn(async () => expectedSnapshot);

    const snapshot = await loadQuoteSnapshot({
      db: {} as any,
      deps: {
        quoteSnapshot: {
          loadQuoteSnapshot: loadQuoteSnapshotPort,
        },
      } as any,
      quoteRef: "quote-ref-crypto",
    });

    expect(snapshot.financialLines).toEqual([
      expect.objectContaining({
        currency: "USDT",
        amount: "0.123456",
        amountMinor: "123456",
      }),
    ]);
    expect(loadQuoteSnapshotPort).toHaveBeenCalledWith({
      db: {},
      quoteRef: "quote-ref-crypto",
    });
  });

  it("delegates quote locking through the injected quote usage port", async () => {
    const markQuoteUsed = vi.fn(async () => {
      throw new Error("already used");
    });

    await expect(
      markQuoteUsedForInvoice({
        db: {} as any,
        deps: {
          quoteUsage: {
            markQuoteUsedForInvoice: markQuoteUsed,
          },
        } as any,
        quoteId: "550e8400-e29b-41d4-a716-446655440010",
        invoiceDocumentId: "doc-1",
        at: new Date("2026-03-03T10:00:00.000Z"),
      }),
    ).rejects.toThrow(/already used/);
  });

  it("reserves customer charges on exchange invoices without recognizing pnl", async () => {
    const now = new Date("2026-03-03T10:00:00.000Z");
    const markQuoteUsed = vi.fn(async () => undefined);

    const plan = await buildExchangeInvoicePostingPlan({
      deps: {
        quoteUsage: {
          markQuoteUsedForInvoice: markQuoteUsed,
        },
      } as any,
      context: { db: {}, now } as any,
      document: {
        id: "invoice-1",
        occurredAt: now,
      } as any,
      bookId: "book-1",
      payload: {
        mode: "exchange",
        occurredAt: now,
        customerId: "customer-1",
        counterpartyId: "counterparty-1",
        organizationRequisiteId: "org-req-1",
        quoteSnapshot: makeQuoteSnapshot([
          {
            id: "fee-1",
            bucket: "fee_revenue",
            currency: "USD",
            amount: "1.5",
            amountMinor: "150",
            source: "rule",
            settlementMode: "in_ledger",
          },
          {
            id: "spread-1",
            bucket: "spread_revenue",
            currency: "USD",
            amount: "-0.25",
            amountMinor: "-25",
            source: "rule",
            settlementMode: "in_ledger",
          },
          {
            id: "pass-through-1",
            bucket: "pass_through",
            currency: "USD",
            amount: "0.4",
            amountMinor: "40",
            source: "rule",
            settlementMode: "separate_payment_order",
          },
          {
            id: "provider-1",
            bucket: "provider_fee_expense",
            currency: "USD",
            amount: "0.3",
            amountMinor: "30",
            source: "rule",
            settlementMode: "in_ledger",
          },
        ]),
      } as any,
    });

    expect(markQuoteUsed).toHaveBeenCalledWith({
      db: {},
      quoteId: "00000000-0000-4000-8000-000000000010",
      invoiceDocumentId: "invoice-1",
      at: now,
    });

    expect(plan.requests.map((request) => request.templateKey)).toEqual([
      POSTING_TEMPLATE_KEY.PAYMENT_FX_PRINCIPAL,
      POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
      POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE_REVERSAL,
      POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
    ]);
  });

  it("finalizes reserved customer lines on exchange posting", () => {
    const plan = buildExchangePostingPlan({
      document: {
        id: "exchange-1",
        occurredAt: new Date("2026-03-03T10:05:00.000Z"),
      } as any,
      bookId: "book-1",
      payload: {
        occurredAt: new Date("2026-03-03T10:05:00.000Z"),
        invoiceDocumentId: "invoice-1",
        customerId: "customer-1",
        counterpartyId: "counterparty-1",
        organizationRequisiteId: "org-req-1",
        quoteSnapshot: makeQuoteSnapshot([
          {
            id: "fee-1",
            bucket: "fee_revenue",
            currency: "USD",
            amount: "1.5",
            amountMinor: "150",
            source: "rule",
            settlementMode: "in_ledger",
          },
          {
            id: "spread-1",
            bucket: "spread_revenue",
            currency: "USD",
            amount: "-0.25",
            amountMinor: "-25",
            source: "rule",
            settlementMode: "in_ledger",
          },
          {
            id: "adjustment-1",
            bucket: "adjustment",
            currency: "USD",
            amount: "0.7",
            amountMinor: "70",
            source: "manual",
            settlementMode: "in_ledger",
          },
          {
            id: "pass-through-1",
            bucket: "pass_through",
            currency: "USD",
            amount: "0.4",
            amountMinor: "40",
            source: "rule",
            settlementMode: "separate_payment_order",
          },
          {
            id: "provider-1",
            bucket: "provider_fee_expense",
            currency: "USD",
            amount: "0.3",
            amountMinor: "30",
            source: "rule",
            settlementMode: "in_ledger",
          },
        ]),
      } as any,
    });

    const templateKeys = plan.requests.map((request) => request.templateKey);

    expect(templateKeys).toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_INCOME_FROM_RESERVE,
    );
    expect(templateKeys).toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_REFUND_RESERVE,
    );
    expect(templateKeys).toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_FX_ADJUSTMENT_CHARGE_FROM_RESERVE,
    );
    expect(templateKeys).toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_FX_PROVIDER_FEE_EXPENSE,
    );
    expect(templateKeys).not.toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_FX_FEE_RESERVE,
    );
  });
});
