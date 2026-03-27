import { describe, expect, it, vi } from "vitest";

import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";

import {
  buildIncomingInvoiceDetails,
  buildPaymentOrderPostingPlan,
  buildQuoteSnapshotHash,
  loadQuoteSnapshot,
  markQuoteUsedForPaymentOrder,
  resolvePaymentOrderAccountingSourceId,
} from "../src/documents/internal/helpers";

const INVOICE_ID = "00000000-0000-4000-8000-000000000001";
const CUSTOMER_ID = "00000000-0000-4000-8000-000000000002";
const COUNTERPARTY_ID = "00000000-0000-4000-8000-000000000003";
const COUNTERPARTY_REQUISITE_ID = "00000000-0000-4000-8000-000000000004";
const ORGANIZATION_REQUISITE_ID = "00000000-0000-4000-8000-000000000005";

function makeQuoteSnapshot() {
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
    financialLines: [],
  };

  return {
    ...snapshot,
    snapshotHash: buildQuoteSnapshotHash(snapshot),
  };
}

describe("commercial document helpers", () => {
  it("builds a deterministic quote snapshot hash", () => {
    const snapshot = makeQuoteSnapshot();

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
      toAmountMinor: "9300",
    } as any);

    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });

  it("delegates quote snapshot loading through the injected port", async () => {
    const expectedSnapshot = makeQuoteSnapshot();
    const loadQuoteSnapshotPort = vi.fn(async () => expectedSnapshot);
    const runtime = {} as any;

    const snapshot = await loadQuoteSnapshot({
      runtime,
      deps: {
        quoteSnapshot: {
          loadQuoteSnapshot: loadQuoteSnapshotPort,
        },
      } as any,
      quoteRef: "quote-ref-crypto",
    });

    expect(snapshot.quoteId).toBe(expectedSnapshot.quoteId);
    expect(loadQuoteSnapshotPort).toHaveBeenCalledWith({
      runtime,
      quoteRef: "quote-ref-crypto",
    });
  });

  it("delegates quote locking through the injected quote usage port", async () => {
    const markQuoteUsed = vi.fn(async () => undefined);
    const runtime = {} as any;

    await markQuoteUsedForPaymentOrder({
      runtime,
      deps: {
        quoteUsage: {
          markQuoteUsedForPaymentOrder: markQuoteUsed,
        },
      } as any,
      quoteId: "550e8400-e29b-41d4-a716-446655440010",
      paymentOrderDocumentId: "doc-1",
      at: new Date("2026-03-03T10:00:00.000Z"),
    });

    expect(markQuoteUsed).toHaveBeenCalledWith({
      runtime,
      quoteId: "550e8400-e29b-41d4-a716-446655440010",
      paymentOrderDocumentId: "doc-1",
      at: new Date("2026-03-03T10:00:00.000Z"),
    });
  });

  it("aggregates incoming_invoice payment state and excludes void payment orders", () => {
    const details = buildIncomingInvoiceDetails({
      payload: {
        occurredAt: "2026-03-03T10:00:00.000Z",
        contour: "intl",
        customerId: "customer-1",
        counterpartyId: "counterparty-1",
        organizationRequisiteId: "org-req-1",
        amount: "100.00",
        amountMinor: "10000",
        currency: "EUR",
      } as any,
      paymentOrders: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          docType: "payment_order",
          docNo: "PPO-1",
          occurredAt: new Date("2026-03-03T10:05:00.000Z"),
          lifecycleStatus: "active",
          postingStatus: "posted",
          payload: {
            occurredAt: "2026-03-03T10:05:00.000Z",
            contour: "intl",
            incomingInvoiceDocumentId: INVOICE_ID,
            customerId: CUSTOMER_ID,
            counterpartyId: COUNTERPARTY_ID,
            counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
            organizationRequisiteId: ORGANIZATION_REQUISITE_ID,
            fundingAmount: "50.00",
            fundingAmountMinor: "5000",
            fundingCurrency: "USD",
            allocatedAmount: "46.00",
            allocatedAmountMinor: "4600",
            allocatedCurrency: "EUR",
            executionStatus: "sent",
          },
        },
        {
          id: "00000000-0000-4000-8000-000000000102",
          docType: "payment_order",
          docNo: "PPO-2",
          occurredAt: new Date("2026-03-03T10:10:00.000Z"),
          lifecycleStatus: "active",
          postingStatus: "posted",
          payload: {
            occurredAt: "2026-03-03T10:10:00.000Z",
            contour: "intl",
            incomingInvoiceDocumentId: INVOICE_ID,
            sourcePaymentOrderDocumentId:
              "00000000-0000-4000-8000-000000000101",
            customerId: CUSTOMER_ID,
            counterpartyId: COUNTERPARTY_ID,
            counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
            organizationRequisiteId: ORGANIZATION_REQUISITE_ID,
            fundingAmount: "50.00",
            fundingAmountMinor: "5000",
            fundingCurrency: "EUR",
            allocatedAmount: "46.00",
            allocatedAmountMinor: "4600",
            allocatedCurrency: "EUR",
            executionStatus: "settled",
          },
        },
        {
          id: "00000000-0000-4000-8000-000000000103",
          docType: "payment_order",
          docNo: "PPO-3",
          occurredAt: new Date("2026-03-03T10:15:00.000Z"),
          lifecycleStatus: "active",
          postingStatus: "posted",
          payload: {
            occurredAt: "2026-03-03T10:15:00.000Z",
            contour: "intl",
            incomingInvoiceDocumentId: INVOICE_ID,
            customerId: CUSTOMER_ID,
            counterpartyId: COUNTERPARTY_ID,
            counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
            organizationRequisiteId: ORGANIZATION_REQUISITE_ID,
            fundingAmount: "20.00",
            fundingAmountMinor: "2000",
            fundingCurrency: "EUR",
            allocatedAmount: "20.00",
            allocatedAmountMinor: "2000",
            allocatedCurrency: "EUR",
            executionStatus: "sent",
          },
        },
        {
          id: "00000000-0000-4000-8000-000000000104",
          docType: "payment_order",
          docNo: "PPO-4",
          occurredAt: new Date("2026-03-03T10:20:00.000Z"),
          lifecycleStatus: "active",
          postingStatus: "posted",
          payload: {
            occurredAt: "2026-03-03T10:20:00.000Z",
            contour: "intl",
            incomingInvoiceDocumentId: INVOICE_ID,
            sourcePaymentOrderDocumentId:
              "00000000-0000-4000-8000-000000000103",
            customerId: CUSTOMER_ID,
            counterpartyId: COUNTERPARTY_ID,
            counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
            organizationRequisiteId: ORGANIZATION_REQUISITE_ID,
            fundingAmount: "20.00",
            fundingAmountMinor: "2000",
            fundingCurrency: "EUR",
            allocatedAmount: "20.00",
            allocatedAmountMinor: "2000",
            allocatedCurrency: "EUR",
            executionStatus: "void",
          },
        },
      ] as any,
    });

    expect(details).toMatchObject({
      allocatedAmountMinor: "4600",
      settledAmountMinor: "4600",
      availableAmountMinor: "5400",
    });
    expect(details.timeline).toHaveLength(4);
  });

  it("builds payment_order posting plans for sent and settled states", async () => {
    const now = new Date("2026-03-03T10:00:00.000Z");
    const sentPlan = await buildPaymentOrderPostingPlan({
      deps: {
        quoteUsage: {
          markQuoteUsedForPaymentOrder: vi.fn(async () => undefined),
        },
      } as any,
      context: { runtime: {}, now } as any,
      document: {
        id: "payment-order-1",
        occurredAt: now,
      } as any,
      bookId: "book-1",
      payload: {
        contour: "rf",
        occurredAt: now.toISOString(),
        incomingInvoiceDocumentId: "invoice-1",
        customerId: CUSTOMER_ID,
        counterpartyId: COUNTERPARTY_ID,
        counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
        organizationRequisiteId: ORGANIZATION_REQUISITE_ID,
        fundingAmount: "100.00",
        fundingAmountMinor: "10000",
        fundingCurrency: "EUR",
        allocatedAmount: "100.00",
        allocatedAmountMinor: "10000",
        allocatedCurrency: "EUR",
        executionStatus: "sent",
      } as any,
    });

    expect(sentPlan.operationCode).toBe(OPERATION_CODE.COMMERCIAL_PAYMENT_ORDER_INITIATE);
    expect(sentPlan.requests.map((request) => request.templateKey)).toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_INITIATE,
    );

    const settledPlan = await buildPaymentOrderPostingPlan({
      deps: {
        quoteUsage: {
          markQuoteUsedForPaymentOrder: vi.fn(async () => undefined),
        },
      } as any,
      context: { runtime: {}, now } as any,
      document: {
        id: "payment-order-2",
        occurredAt: now,
      } as any,
      bookId: "book-1",
      payload: {
        contour: "rf",
        occurredAt: now.toISOString(),
        incomingInvoiceDocumentId: "invoice-1",
        customerId: CUSTOMER_ID,
        counterpartyId: COUNTERPARTY_ID,
        counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
        organizationRequisiteId: ORGANIZATION_REQUISITE_ID,
        fundingAmount: "100.00",
        fundingAmountMinor: "10000",
        fundingCurrency: "EUR",
        allocatedAmount: "100.00",
        allocatedAmountMinor: "10000",
        allocatedCurrency: "EUR",
        executionStatus: "settled",
      } as any,
    });

    expect(settledPlan.operationCode).toBe(OPERATION_CODE.COMMERCIAL_PAYMENT_ORDER_SETTLE);
    expect(settledPlan.requests.map((request) => request.templateKey)).toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_IMMEDIATE,
    );
  });

  it("builds payment_order resolution plans for settle and void states", async () => {
    const now = new Date("2026-03-03T10:00:00.000Z");
    const sourcePayload = {
      contour: "rf",
      occurredAt: now.toISOString(),
      incomingInvoiceDocumentId: "invoice-1",
      customerId: CUSTOMER_ID,
      counterpartyId: COUNTERPARTY_ID,
      counterpartyRequisiteId: COUNTERPARTY_REQUISITE_ID,
      organizationRequisiteId: ORGANIZATION_REQUISITE_ID,
      fundingAmount: "100.00",
      fundingAmountMinor: "10000",
      fundingCurrency: "EUR",
      allocatedAmount: "100.00",
      allocatedAmountMinor: "10000",
      allocatedCurrency: "EUR",
      executionStatus: "sent",
      executionRef: "rail-1",
    } as any;

    const settledPlan = await buildPaymentOrderPostingPlan({
      deps: {
        quoteUsage: {
          markQuoteUsedForPaymentOrder: vi.fn(async () => undefined),
        },
      } as any,
      context: { runtime: {}, now } as any,
      document: {
        id: "payment-order-resolution-1",
        occurredAt: now,
      } as any,
      bookId: "book-1",
      payload: {
        ...sourcePayload,
        sourcePaymentOrderDocumentId: "payment-order-1",
        executionStatus: "settled",
      } as any,
      resolutionSource: {
        document: { id: "payment-order-1" } as any,
        payload: sourcePayload,
        pendingTransfer: {
          transferId: 101n,
          pendingRef: "payment_order:payment-order-1",
          amountMinor: 10000n,
        },
      },
    });

    expect(settledPlan.operationCode).toBe(
      OPERATION_CODE.COMMERCIAL_PAYMENT_ORDER_SETTLE,
    );
    expect(settledPlan.requests).toEqual([
      expect.objectContaining({
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_SETTLE,
        pending: expect.objectContaining({
          pendingId: 101n,
          amountMinor: 10000n,
        }),
      }),
    ]);

    const voidPlan = await buildPaymentOrderPostingPlan({
      deps: {
        quoteUsage: {
          markQuoteUsedForPaymentOrder: vi.fn(async () => undefined),
        },
      } as any,
      context: { runtime: {}, now } as any,
      document: {
        id: "payment-order-resolution-2",
        occurredAt: now,
      } as any,
      bookId: "book-1",
      payload: {
        ...sourcePayload,
        sourcePaymentOrderDocumentId: "payment-order-1",
        executionStatus: "failed",
      } as any,
      resolutionSource: {
        document: { id: "payment-order-1" } as any,
        payload: sourcePayload,
        pendingTransfer: {
          transferId: 101n,
          pendingRef: "payment_order:payment-order-1",
          amountMinor: 10000n,
        },
      },
    });

    expect(voidPlan.operationCode).toBe(
      OPERATION_CODE.COMMERCIAL_PAYMENT_ORDER_VOID,
    );
    expect(voidPlan.requests).toEqual([
      expect.objectContaining({
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
        pending: expect.objectContaining({
          pendingId: 101n,
          amountMinor: 0n,
        }),
      }),
    ]);
  });

  it("maps payment_order execution statuses to accounting sources", () => {
    expect(
      resolvePaymentOrderAccountingSourceId({
        executionStatus: "sent",
      } as any),
    ).toBe(ACCOUNTING_SOURCE_ID.PAYMENT_ORDER_INITIATE);
    expect(
      resolvePaymentOrderAccountingSourceId({
        executionStatus: "settled",
      } as any),
    ).toBe(ACCOUNTING_SOURCE_ID.PAYMENT_ORDER_SETTLE);
    expect(
      resolvePaymentOrderAccountingSourceId({
        executionStatus: "failed",
      } as any),
    ).toBe(ACCOUNTING_SOURCE_ID.PAYMENT_ORDER_VOID);
  });
});
