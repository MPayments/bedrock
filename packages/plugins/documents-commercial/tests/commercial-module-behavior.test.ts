import { describe, expect, it, vi } from "vitest";

import {
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";

import { createIncomingInvoiceDocumentModule } from "../src/documents/incoming-invoice";
import { createOutgoingInvoiceDocumentModule } from "../src/documents/outgoing-invoice";
import { createPaymentOrderDocumentModule } from "../src/documents/payment-order";

function createQuoteSnapshot() {
  return {
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
    snapshotHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
}

function createDeps() {
  return {
    documentRelations: {
      loadIncomingInvoice: vi.fn(async () => {
        throw new Error("loadIncomingInvoice not configured");
      }),
      loadPaymentOrder: vi.fn(async () => {
        throw new Error("loadPaymentOrder not configured");
      }),
      listIncomingInvoicePaymentOrders: vi.fn(async () => []),
      listPaymentOrderResolutions: vi.fn(async () => []),
    },
    ledgerRead: {
      getOperationDetails: vi.fn(async () => null),
    },
    quoteSnapshot: {
      loadQuoteSnapshot: vi.fn(async () => createQuoteSnapshot()),
      createQuoteSnapshot: vi.fn(async () => createQuoteSnapshot()),
    },
    quoteUsage: {
      markQuoteUsedForPaymentOrder: vi.fn(async () => undefined),
    },
    requisiteBindings: {
      resolveBinding: vi.fn(async () => ({
        requisiteId: "00000000-0000-4000-8000-000000000111",
        bookId: "00000000-0000-4000-8000-000000000112",
        organizationId: "00000000-0000-4000-8000-000000000113",
        currencyCode: "USD",
        postingAccountNo: "1010",
        bookAccountInstanceId: "00000000-0000-4000-8000-000000000114",
      })),
    },
    partyReferences: {
      assertCustomerExists: vi.fn(async () => undefined),
      assertCounterpartyExists: vi.fn(async () => undefined),
      assertCounterpartyLinkedToCustomer: vi.fn(async () => undefined),
    },
  };
}

function createPostedIncomingInvoice() {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    docType: "incoming_invoice",
    docNo: "IIN-1",
    payloadVersion: 1,
    payload: {
      occurredAt: "2026-03-03T10:00:00.000Z",
      contour: "intl",
      customerId: "00000000-0000-4000-8000-000000000301",
      counterpartyId: "00000000-0000-4000-8000-000000000302",
      organizationId: "00000000-0000-4000-8000-000000000113",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
      amount: "100.00",
      amountMinor: "10000",
      currency: "EUR",
      memo: "incoming invoice",
    },
    occurredAt: new Date("2026-03-03T10:00:00.000Z"),
    lifecycleStatus: "active",
    postingStatus: "posted",
  };
}

function createPostingIncomingInvoice() {
  return {
    ...createPostedIncomingInvoice(),
    postingStatus: "posting",
  };
}

function createPostedSentPaymentOrder() {
  return {
    id: "00000000-0000-4000-8000-000000000401",
    docType: "payment_order",
    docNo: "PPO-1",
    payloadVersion: 1,
    payload: {
      occurredAt: "2026-03-04T10:00:00.000Z",
      contour: "rf",
      incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
      customerId: "00000000-0000-4000-8000-000000000301",
      counterpartyId: "00000000-0000-4000-8000-000000000302",
      counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
      organizationId: "00000000-0000-4000-8000-000000000113",
      organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
      fundingAmount: "100.00",
      fundingAmountMinor: "10000",
      fundingCurrency: "EUR",
      allocatedAmount: "100.00",
      allocatedAmountMinor: "10000",
      allocatedCurrency: "EUR",
      executionStatus: "sent",
      executionRef: "rail-1",
    },
    occurredAt: new Date("2026-03-04T10:00:00.000Z"),
    lifecycleStatus: "active",
    postingStatus: "posted",
  };
}

function createPostingSentPaymentOrder() {
  return {
    ...createPostedSentPaymentOrder(),
    postingStatus: "posting",
  };
}

function createDraftContext(input: {
  docType: string;
  docNo: string;
  operationIdempotencyKey?: string | null;
}) {
  return {
    runtime: {} as any,
    now: new Date("2026-03-03T10:00:00.000Z"),
    draft: {
      id: "00000000-0000-4000-8000-000000000901",
      docNo: input.docNo,
      docType: input.docType,
      moduleId: input.docType,
      moduleVersion: 1,
      payloadVersion: 1,
    },
    operationIdempotencyKey: input.operationIdempotencyKey ?? null,
  };
}

describe("commercial document modules", () => {
  it("validates customer/counterparty references for incoming_invoice", async () => {
    const deps = createDeps();
    const module = createIncomingInvoiceDocumentModule(deps as any);

    await module.canCreate(
      {} as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        contour: "rf",
        customerId: "00000000-0000-4000-8000-000000000301",
        counterpartyId: "00000000-0000-4000-8000-000000000302",
        organizationId: "00000000-0000-4000-8000-000000000113",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
        amount: "100.00",
        amountMinor: "10000",
        currency: "USD",
        memo: "invoice",
      },
    );

    expect(deps.partyReferences.assertCustomerExists).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000301",
    );
    expect(deps.partyReferences.assertCounterpartyExists).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000302",
    );
    expect(
      deps.partyReferences.assertCounterpartyLinkedToCustomer,
    ).toHaveBeenCalledWith({
      customerId: "00000000-0000-4000-8000-000000000301",
      counterpartyId: "00000000-0000-4000-8000-000000000302",
    });
  });

  it("creates incoming_invoice draft without memo", async () => {
    const deps = createDeps();
    const module = createIncomingInvoiceDocumentModule(deps as any);

    const draft = await module.createDraft(
      createDraftContext({
        docType: "incoming_invoice",
        docNo: "IIN-1",
      }) as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        contour: "rf",
        customerId: "00000000-0000-4000-8000-000000000301",
        counterpartyId: "00000000-0000-4000-8000-000000000302",
        organizationId: "00000000-0000-4000-8000-000000000113",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
        amount: "100.00",
        amountMinor: "10000",
        currency: "USD",
      } as any,
    );

    expect(draft.payload).toMatchObject({
      contour: "rf",
      currency: "USD",
    });
  });

  it("rejects incoming_invoice when counterparty is not linked to customer", async () => {
    const deps = createDeps();
    deps.partyReferences.assertCounterpartyLinkedToCustomer = vi.fn(async () => {
      throw new Error("counterparty/customer mismatch");
    });
    const module = createIncomingInvoiceDocumentModule(deps as any);

    await expect(
      module.canCreate(
        {} as any,
        {
          occurredAt: new Date("2026-03-03T10:00:00.000Z"),
          contour: "rf",
          customerId: "00000000-0000-4000-8000-000000000301",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          organizationId: "00000000-0000-4000-8000-000000000113",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          amount: "100.00",
          amountMinor: "10000",
          currency: "USD",
          memo: "invoice",
        },
      ),
    ).rejects.toThrow("counterparty/customer mismatch");
  });

  it("builds incoming_invoice details with aggregated payment state", async () => {
    const deps = createDeps();
    deps.documentRelations.listIncomingInvoicePaymentOrders = vi.fn(async () => [
      {
        id: "po-1",
        docType: "payment_order",
        docNo: "PPO-1",
        occurredAt: new Date("2026-03-03T10:05:00.000Z"),
        lifecycleStatus: "active",
        postingStatus: "posted",
        payload: {
          occurredAt: "2026-03-03T10:05:00.000Z",
          contour: "intl",
          incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
          customerId: "00000000-0000-4000-8000-000000000301",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          fundingAmount: "50.00",
          fundingAmountMinor: "5000",
          fundingCurrency: "USD",
          allocatedAmount: "46.00",
          allocatedAmountMinor: "4600",
          allocatedCurrency: "EUR",
          executionStatus: "sent",
        },
      },
    ]);

    const module = createIncomingInvoiceDocumentModule(deps as any);
    const details = await module.buildDetails?.(
      createDraftContext({
        docType: "incoming_invoice",
        docNo: "IIN-1",
      }) as any,
      createPostedIncomingInvoice() as any,
    );

    expect(details?.computed).toMatchObject({
      allocatedAmountMinor: "4600",
      settledAmountMinor: "0",
      availableAmountMinor: "5400",
    });
  });

  it("creates FX-backed payment_order drafts from current rates", async () => {
    const deps = createDeps();
    deps.documentRelations.loadIncomingInvoice = vi.fn(async () =>
      createPostedIncomingInvoice(),
    );
    const module = createPaymentOrderDocumentModule(deps as any);
    const context = createDraftContext({
      docType: "payment_order",
      docNo: "PPO-1",
      operationIdempotencyKey: "create-idem",
    });

    const draft = await module.createDraft(
      context as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        contour: "intl",
        incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
        counterpartyId: "00000000-0000-4000-8000-000000000302",
        counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
        organizationId: "00000000-0000-4000-8000-000000000113",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
        amount: "100.00",
        amountMinor: "10000",
        currency: "USD",
        allocatedCurrency: "EUR",
        executionStatus: "sent",
        memo: "payment order",
      },
    );

    expect(deps.quoteSnapshot.createQuoteSnapshot).toHaveBeenCalledWith({
      runtime: context.runtime,
      fromCurrency: "USD",
      toCurrency: "EUR",
      fromAmountMinor: "10000",
      asOf: new Date("2026-03-03T10:00:00.000Z"),
      idempotencyKey: "documents:payment_order:quote:create-idem:USD:EUR:10000",
    });
    expect(draft.payload).toMatchObject({
      customerId: "00000000-0000-4000-8000-000000000301",
      fundingCurrency: "USD",
      allocatedCurrency: "EUR",
      allocatedAmountMinor: "9200",
    });
  });

  it("allows payment_order drafts from incoming_invoice that is still posting", async () => {
    const deps = createDeps();
    deps.documentRelations.loadIncomingInvoice = vi.fn(async () =>
      createPostingIncomingInvoice(),
    );
    const module = createPaymentOrderDocumentModule(deps as any);
    const context = createDraftContext({
      docType: "payment_order",
      docNo: "PPO-1",
      operationIdempotencyKey: "create-idem",
    });

    const draft = await module.createDraft(
      context as any,
      {
        occurredAt: new Date("2026-03-03T10:00:00.000Z"),
        contour: "intl",
        incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
        counterpartyId: "00000000-0000-4000-8000-000000000302",
        counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
        organizationId: "00000000-0000-4000-8000-000000000113",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
        amount: "100.00",
        amountMinor: "10000",
        currency: "USD",
        allocatedCurrency: "EUR",
        executionStatus: "sent",
      },
    );

    expect(draft.payload).toMatchObject({
      incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
      fundingCurrency: "USD",
      allocatedCurrency: "EUR",
    });
  });

  it("rejects over-allocation for payment_order drafts", async () => {
    const deps = createDeps();
    deps.documentRelations.loadIncomingInvoice = vi.fn(async () =>
      createPostedIncomingInvoice(),
    );
    deps.documentRelations.listIncomingInvoicePaymentOrders = vi.fn(async () => [
      {
        id: "po-existing",
        docType: "payment_order",
        occurredAt: new Date("2026-03-03T10:05:00.000Z"),
        lifecycleStatus: "active",
        postingStatus: "posted",
        payload: {
          occurredAt: "2026-03-03T10:05:00.000Z",
          contour: "intl",
          incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
          customerId: "00000000-0000-4000-8000-000000000301",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          fundingAmount: "90.00",
          fundingAmountMinor: "9000",
          fundingCurrency: "EUR",
          allocatedAmount: "90.00",
          allocatedAmountMinor: "9000",
          allocatedCurrency: "EUR",
          executionStatus: "sent",
        },
      },
    ]);
    deps.requisiteBindings.resolveBinding = vi.fn(async () => ({
      requisiteId: "00000000-0000-4000-8000-000000000111",
      bookId: "00000000-0000-4000-8000-000000000112",
      organizationId: "00000000-0000-4000-8000-000000000113",
      currencyCode: "EUR",
      postingAccountNo: "1010",
      bookAccountInstanceId: "00000000-0000-4000-8000-000000000114",
    }));
    const module = createPaymentOrderDocumentModule(deps as any);

    await expect(
      module.createDraft(
        createDraftContext({
          docType: "payment_order",
          docNo: "PPO-2",
        }) as any,
        {
          occurredAt: new Date("2026-03-03T10:00:00.000Z"),
          contour: "intl",
          incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
          organizationId: "00000000-0000-4000-8000-000000000113",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          amount: "20.00",
          amountMinor: "2000",
          currency: "EUR",
          allocatedCurrency: "EUR",
          executionStatus: "sent",
          memo: "payment order",
        },
      ),
    ).rejects.toThrow(
      "payment_order allocated amount exceeds incoming_invoice available amount",
    );
  });

  it("builds a parent link from payment_order to incoming_invoice", async () => {
    const module = createPaymentOrderDocumentModule(createDeps() as any);

    await expect(
      module.buildInitialLinks?.(
        {} as any,
        {
          id: "00000000-0000-4000-8000-000000000401",
          docType: "payment_order",
          docNo: "PPO-1",
          occurredAt: new Date("2026-03-04T10:00:00.000Z"),
          payload: {
            occurredAt: "2026-03-04T10:00:00.000Z",
            contour: "intl",
            incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
            customerId: "00000000-0000-4000-8000-000000000301",
            counterpartyId: "00000000-0000-4000-8000-000000000302",
            counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
            organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
            fundingAmount: "100.00",
            fundingAmountMinor: "10000",
            fundingCurrency: "EUR",
            allocatedAmount: "100.00",
            allocatedAmountMinor: "10000",
            allocatedCurrency: "EUR",
            executionStatus: "sent",
          },
        } as any,
      ),
    ).resolves.toEqual([
      {
        toDocumentId: "00000000-0000-4000-8000-000000000201",
        linkType: "parent",
      },
    ]);
  });

  it("builds a depends_on link for payment_order resolution documents", async () => {
    const module = createPaymentOrderDocumentModule(createDeps() as any);

    await expect(
      module.buildInitialLinks?.(
        {} as any,
        {
          id: "00000000-0000-4000-8000-000000000402",
          docType: "payment_order",
          docNo: "PPO-2",
          occurredAt: new Date("2026-03-04T10:10:00.000Z"),
          payload: {
            occurredAt: "2026-03-04T10:10:00.000Z",
            contour: "rf",
            incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
            sourcePaymentOrderDocumentId:
              "00000000-0000-4000-8000-000000000401",
            customerId: "00000000-0000-4000-8000-000000000301",
            counterpartyId: "00000000-0000-4000-8000-000000000302",
            counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
            organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
            fundingAmount: "100.00",
            fundingAmountMinor: "10000",
            fundingCurrency: "EUR",
            allocatedAmount: "100.00",
            allocatedAmountMinor: "10000",
            allocatedCurrency: "EUR",
            executionStatus: "failed",
          },
        } as any,
      ),
    ).resolves.toEqual([
      {
        toDocumentId: "00000000-0000-4000-8000-000000000201",
        linkType: "parent",
      },
      {
        toDocumentId: "00000000-0000-4000-8000-000000000401",
        linkType: "depends_on",
      },
    ]);
  });

  it("allows payment_order resolutions from source payment_order that is still posting", async () => {
    const deps = createDeps();
    deps.documentRelations.loadIncomingInvoice = vi.fn(async () =>
      createPostedIncomingInvoice(),
    );
    deps.documentRelations.loadPaymentOrder = vi.fn(async () =>
      createPostingSentPaymentOrder(),
    );
    deps.ledgerRead.getOperationDetails = vi.fn(async () => ({
      operation: {} as any,
      postings: [],
      tbPlans: [
        {
          id: "plan_1",
          lineNo: 1,
          type: "create",
          transferId: 99n,
          debitTbAccountId: null,
          creditTbAccountId: null,
          tbLedger: 1,
          amount: 10_000n,
          code: 3101,
          pendingRef: "payment_order:00000000-0000-4000-8000-000000000401",
          pendingId: null,
          isLinked: false,
          isPending: true,
          timeoutSeconds: 3600,
          status: "pending",
          error: null,
          createdAt: new Date("2026-03-04T10:00:00.000Z"),
        },
      ],
    }));
    deps.requisiteBindings.resolveBinding = vi.fn(async () => ({
      requisiteId: "00000000-0000-4000-8000-000000000111",
      bookId: "00000000-0000-4000-8000-000000000112",
      organizationId: "00000000-0000-4000-8000-000000000113",
      currencyCode: "EUR",
      postingAccountNo: "1010",
      bookAccountInstanceId: "00000000-0000-4000-8000-000000000114",
    }));
    const module = createPaymentOrderDocumentModule(deps as any);

    const draft = await module.createDraft(
      {
        ...createDraftContext({
          docType: "payment_order",
          docNo: "PPO-2",
        }),
        runtime: {
          documents: {
            getDocumentOperationId: vi.fn(async () => "op-payment-order-1"),
          },
        },
      } as any,
      {
        occurredAt: new Date("2026-03-05T10:00:00.000Z"),
        contour: "rf",
        incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
        sourcePaymentOrderDocumentId:
          "00000000-0000-4000-8000-000000000401",
        customerId: "00000000-0000-4000-8000-000000000301",
        counterpartyId: "00000000-0000-4000-8000-000000000302",
        counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
        organizationId: "00000000-0000-4000-8000-000000000113",
        organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
        amount: "100.00",
        amountMinor: "10000",
        currency: "EUR",
        allocatedCurrency: "EUR",
        executionStatus: "settled",
      },
    );

    expect(draft.payload).toMatchObject({
      sourcePaymentOrderDocumentId:
        "00000000-0000-4000-8000-000000000401",
      executionStatus: "settled",
    });
  });

  it("builds immediate postings for settled payment_order", async () => {
    const deps = createDeps();
    deps.documentRelations.loadIncomingInvoice = vi.fn(async () =>
      createPostedIncomingInvoice(),
    );
    deps.requisiteBindings.resolveBinding = vi.fn(async () => ({
      requisiteId: "00000000-0000-4000-8000-000000000111",
      bookId: "00000000-0000-4000-8000-000000000112",
      organizationId: "00000000-0000-4000-8000-000000000113",
      currencyCode: "EUR",
      postingAccountNo: "1010",
      bookAccountInstanceId: "00000000-0000-4000-8000-000000000114",
    }));
    const module = createPaymentOrderDocumentModule(deps as any);

    const postingPlan = await module.buildPostingPlan?.(
      createDraftContext({
        docType: "payment_order",
        docNo: "PPO-1",
      }) as any,
      {
        id: "00000000-0000-4000-8000-000000000501",
        docType: "payment_order",
        docNo: "PPO-1",
        occurredAt: new Date("2026-03-04T10:00:00.000Z"),
        payload: {
          occurredAt: "2026-03-04T10:00:00.000Z",
          contour: "rf",
          incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
          customerId: "00000000-0000-4000-8000-000000000301",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          fundingAmount: "100.00",
          fundingAmountMinor: "10000",
          fundingCurrency: "EUR",
          allocatedAmount: "100.00",
          allocatedAmountMinor: "10000",
          allocatedCurrency: "EUR",
          executionStatus: "settled",
          executionRef: "rail-1",
        },
      } as any,
    );

    expect(postingPlan?.operationCode).toBe(
      OPERATION_CODE.COMMERCIAL_PAYMENT_ORDER_SETTLE,
    );
    expect(postingPlan?.requests.map((request) => request.templateKey)).toContain(
      POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_IMMEDIATE,
    );
  });

  it("builds pending void postings for payment_order resolutions", async () => {
    const deps = createDeps();
    deps.documentRelations.loadIncomingInvoice = vi.fn(async () =>
      createPostedIncomingInvoice(),
    );
    deps.documentRelations.loadPaymentOrder = vi.fn(async () =>
      createPostedSentPaymentOrder(),
    );
    deps.ledgerRead.getOperationDetails = vi.fn(async () => ({
      operation: {} as any,
      postings: [],
      tbPlans: [
        {
          id: "plan_1",
          lineNo: 1,
          type: "create",
          transferId: 99n,
          debitTbAccountId: null,
          creditTbAccountId: null,
          tbLedger: 1,
          amount: 10_000n,
          code: 3101,
          pendingRef: "payment_order:00000000-0000-4000-8000-000000000401",
          pendingId: null,
          isLinked: false,
          isPending: true,
          timeoutSeconds: 3600,
          status: "pending",
          error: null,
          createdAt: new Date("2026-03-04T10:00:00.000Z"),
        },
      ],
    }));
    deps.requisiteBindings.resolveBinding = vi.fn(async () => ({
      requisiteId: "00000000-0000-4000-8000-000000000111",
      bookId: "00000000-0000-4000-8000-000000000112",
      organizationId: "00000000-0000-4000-8000-000000000113",
      currencyCode: "EUR",
      postingAccountNo: "1010",
      bookAccountInstanceId: "00000000-0000-4000-8000-000000000114",
    }));
    const module = createPaymentOrderDocumentModule(deps as any);

    const postingPlan = await module.buildPostingPlan?.(
      {
        ...createDraftContext({
          docType: "payment_order",
          docNo: "PPO-2",
        }),
        runtime: {
          documents: {
            getDocumentOperationId: vi.fn(async () => "op-payment-order-1"),
          },
        },
      } as any,
      {
        id: "00000000-0000-4000-8000-000000000402",
        docType: "payment_order",
        docNo: "PPO-2",
        occurredAt: new Date("2026-03-04T10:10:00.000Z"),
        payload: {
          occurredAt: "2026-03-04T10:10:00.000Z",
          contour: "rf",
          incomingInvoiceDocumentId: "00000000-0000-4000-8000-000000000201",
          sourcePaymentOrderDocumentId:
            "00000000-0000-4000-8000-000000000401",
          customerId: "00000000-0000-4000-8000-000000000301",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
          organizationId: "00000000-0000-4000-8000-000000000113",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          fundingAmount: "100.00",
          fundingAmountMinor: "10000",
          fundingCurrency: "EUR",
          allocatedAmount: "100.00",
          allocatedAmountMinor: "10000",
          allocatedCurrency: "EUR",
          executionStatus: "failed",
        },
      } as any,
    );

    expect(postingPlan?.operationCode).toBe(
      OPERATION_CODE.COMMERCIAL_PAYMENT_ORDER_VOID,
    );
    expect(postingPlan?.requests).toEqual([
      expect.objectContaining({
        templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
        pending: expect.objectContaining({
          pendingId: 99n,
          amountMinor: 0n,
        }),
      }),
    ]);
  });

  it("opens receivable debt for outgoing_invoice", async () => {
    const deps = createDeps();
    deps.requisiteBindings.resolveBinding = vi.fn(async () => ({
      requisiteId: "00000000-0000-4000-8000-000000000111",
      bookId: "00000000-0000-4000-8000-000000000112",
      organizationId: "00000000-0000-4000-8000-000000000113",
      currencyCode: "EUR",
      postingAccountNo: "1010",
      bookAccountInstanceId: "00000000-0000-4000-8000-000000000114",
    }));
    const module = createOutgoingInvoiceDocumentModule(deps as any);

    const postingPlan = await module.buildPostingPlan?.(
      {} as any,
      {
        id: "00000000-0000-4000-8000-000000000601",
        docType: "outgoing_invoice",
        docNo: "OIN-1",
        occurredAt: new Date("2026-03-04T10:00:00.000Z"),
        payload: {
          occurredAt: "2026-03-04T10:00:00.000Z",
          contour: "rf",
          counterpartyId: "00000000-0000-4000-8000-000000000302",
          counterpartyRequisiteId: "00000000-0000-4000-8000-000000000303",
          organizationRequisiteId: "00000000-0000-4000-8000-000000000111",
          amount: "100.00",
          amountMinor: "10000",
          currency: "EUR",
        },
      } as any,
    );

    expect(postingPlan?.operationCode).toBe(
      OPERATION_CODE.COMMERCIAL_OUTGOING_INVOICE_OPEN,
    );
    expect(postingPlan?.requests[0]?.templateKey).toBe(
      POSTING_TEMPLATE_KEY.COMMERCIAL_OUTGOING_INVOICE_OPEN,
    );
  });
});
