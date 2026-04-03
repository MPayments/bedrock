import { describe, expect, it, vi } from "vitest";

import {
  compileDealExecutionRecipe,
  createDealExecutionWorkflow,
} from "../src";

function createWorkflowProjection(input?: {
  acceptedQuoteId?: string | null;
  operationRefs?: {
    kind: string;
    operationId: string;
    sourceRef: string;
  }[][];
  status?: string;
  transitionAllowed?: boolean;
  type?: "payment" | "currency_exchange" | "currency_transit" | "exporter_settlement";
  withConvert?: boolean;
}) {
  const type = input?.type ?? "payment";
  const withConvert = input?.withConvert ?? false;
  const legs =
    type === "payment"
      ? [
          { id: "leg-1", idx: 1, kind: "collect", state: "ready" },
          ...(withConvert
            ? [{ id: "leg-2", idx: 2, kind: "convert", state: "ready" }]
            : []),
          {
            id: withConvert ? "leg-3" : "leg-2",
            idx: withConvert ? 3 : 2,
            kind: "payout",
            state: "pending",
          },
        ]
      : type === "currency_exchange"
        ? [
            { id: "leg-1", idx: 1, kind: "collect", state: "ready" },
            { id: "leg-2", idx: 2, kind: "convert", state: "ready" },
            { id: "leg-3", idx: 3, kind: "payout", state: "pending" },
          ]
        : type === "currency_transit"
          ? [
              { id: "leg-1", idx: 1, kind: "collect", state: "ready" },
              ...(withConvert
                ? [{ id: "leg-2", idx: 2, kind: "convert", state: "ready" }]
                : []),
              {
                id: withConvert ? "leg-3" : "leg-2",
                idx: withConvert ? 3 : 2,
                kind: "transit_hold",
                state: "pending",
              },
              {
                id: withConvert ? "leg-4" : "leg-3",
                idx: withConvert ? 4 : 3,
                kind: "payout",
                state: "pending",
              },
            ]
          : [
              { id: "leg-1", idx: 1, kind: "payout", state: "pending" },
              { id: "leg-2", idx: 2, kind: "collect", state: "ready" },
              ...(withConvert
                ? [{ id: "leg-3", idx: 3, kind: "convert", state: "ready" }]
                : []),
              {
                id: withConvert ? "leg-4" : "leg-3",
                idx: withConvert ? 4 : 3,
                kind: "settle_exporter",
                state: "pending",
              },
            ];

  return {
    acceptedQuote: input?.acceptedQuoteId
      ? {
          acceptedAt: new Date("2026-04-03T10:00:00.000Z"),
          acceptedByUserId: "user-1",
          agreementVersionId: null,
          dealId: "deal-1",
          dealRevision: 1,
          expiresAt: new Date("2099-04-03T12:00:00.000Z"),
          id: "acceptance-1",
          quoteId: input.acceptedQuoteId,
          quoteStatus: "active",
          replacedByQuoteId: null,
          revokedAt: null,
          usedAt: null,
          usedDocumentId: null,
        }
      : null,
    attachmentIngestions: [],
    executionPlan: legs.map((leg, index) => ({
      ...leg,
      operationRefs: input?.operationRefs?.[index] ?? [],
    })),
    intake: {
      common: {
        applicantCounterpartyId: "counterparty-1",
        customerNote: null,
        requestedExecutionDate: new Date("2026-04-04T00:00:00.000Z"),
      },
      externalBeneficiary: {
        bankInstructionSnapshot: null,
        beneficiaryCounterpartyId: "beneficiary-1",
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: "contract-1",
        expectedAmount: "90.00",
        expectedAt: null,
        expectedCurrencyId: "cur-eur",
        invoiceNumber: "invoice-1",
        payerCounterpartyId: "payer-1",
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Treasury execution",
        sourceAmount: "100.00",
        sourceCurrencyId: "cur-usd",
        targetCurrencyId: withConvert ? "cur-eur" : null,
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type,
    },
    nextAction: "Request execution",
    operationalState: {
      capabilities: [],
      positions: [],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: "customer-1",
        displayName: "Customer",
        id: "participant-customer",
        organizationId: null,
        role: "customer",
      },
      {
        counterpartyId: null,
        customerId: null,
        displayName: "Internal entity",
        id: "participant-internal",
        organizationId: "org-1",
        role: "internal_entity",
      },
    ],
    relatedResources: {
      attachments: [],
      calculations: [],
      formalDocuments: [],
      quotes: [],
    },
    revision: 1,
    sectionCompleteness: [],
    summary: {
      agreementId: "agreement-1",
      agentId: null,
      calculationId: null,
      createdAt: new Date("2026-04-03T09:00:00.000Z"),
      id: "deal-1",
      status: input?.status ?? "submitted",
      type,
      updatedAt: new Date("2026-04-03T09:00:00.000Z"),
    },
    timeline: [],
    transitionReadiness: [
      {
        allowed: input?.transitionAllowed ?? true,
        blockers: input?.transitionAllowed === false
          ? [
              {
                code: "execution_leg_not_ready",
                message: "Execution is blocked",
              },
            ]
          : [],
        targetStatus: "awaiting_funds",
      },
    ],
  } as any;
}

function createAcceptedQuoteDetails() {
  return {
    feeComponents: [],
    financialLines: [],
    legs: [],
    pricingTrace: {},
    quote: {
      createdAt: new Date("2026-04-03T10:00:00.000Z"),
      dealDirection: null,
      dealForm: null,
      dealId: "deal-1",
      expiresAt: new Date("2099-04-03T12:00:00.000Z"),
      fromAmountMinor: 10000n,
      fromCurrency: "USD",
      fromCurrencyId: "cur-usd",
      id: "quote-1",
      idempotencyKey: "quote-1",
      pricingMode: "auto_cross",
      pricingTrace: {},
      rateDen: 100n,
      rateNum: 90n,
      status: "active",
      toAmountMinor: 9000n,
      toCurrency: "EUR",
      toCurrencyId: "cur-eur",
      usedAt: null,
      usedByRef: null,
      usedDocumentId: null,
    },
  } as any;
}

describe("deal execution workflow", () => {
  it("compiles payment into payin and payout refs", () => {
    const workflow = createWorkflowProjection({
      type: "payment",
      withConvert: false,
    });

    expect(
      compileDealExecutionRecipe({
        acceptedQuote: null,
        agreementOrganizationId: "org-1",
        internalEntityOrganizationId: "org-1",
        workflow,
      }).map((item) => [item.legKind, item.operationKind, item.sourceRef]),
    ).toEqual([
      ["collect", "payin", "deal:deal-1:leg:1:payin:1"],
      ["payout", "payout", "deal:deal-1:leg:2:payout:1"],
    ]);
  });

  it("compiles currency_exchange into payin, fx conversion, and payout refs", () => {
    const workflow = createWorkflowProjection({
      acceptedQuoteId: "quote-1",
      type: "currency_exchange",
      withConvert: true,
    });

    expect(
      compileDealExecutionRecipe({
        acceptedQuote: createAcceptedQuoteDetails(),
        agreementOrganizationId: "org-1",
        internalEntityOrganizationId: "org-1",
        workflow,
      }).map((item) => [item.legKind, item.operationKind, item.sourceRef]),
    ).toEqual([
      ["collect", "payin", "deal:deal-1:leg:1:payin:1"],
      ["convert", "fx_conversion", "deal:deal-1:leg:2:fx_conversion:1"],
      ["payout", "payout", "deal:deal-1:leg:3:payout:1"],
    ]);
  });

  it("compiles currency_transit into transfer funding on the transit leg", () => {
    const workflow = createWorkflowProjection({
      acceptedQuoteId: "quote-1",
      type: "currency_transit",
      withConvert: true,
    });

    expect(
      compileDealExecutionRecipe({
        acceptedQuote: createAcceptedQuoteDetails(),
        agreementOrganizationId: "org-1",
        internalEntityOrganizationId: "org-1",
        workflow,
      }).map((item) => [item.legKind, item.operationKind, item.sourceRef]),
    ).toEqual([
      ["collect", "payin", "deal:deal-1:leg:1:payin:1"],
      ["convert", "fx_conversion", "deal:deal-1:leg:2:fx_conversion:1"],
      [
        "transit_hold",
        "intracompany_transfer",
        "deal:deal-1:leg:3:intracompany_transfer:1",
      ],
      ["payout", "payout", "deal:deal-1:leg:4:payout:1"],
    ]);
  });

  it("compiles exporter settlement into payout, payin, fx conversion, and funding using the same organization rule", () => {
    const workflow = createWorkflowProjection({
      acceptedQuoteId: "quote-1",
      type: "exporter_settlement",
      withConvert: true,
    });

    expect(
      compileDealExecutionRecipe({
        acceptedQuote: createAcceptedQuoteDetails(),
        agreementOrganizationId: "org-external",
        internalEntityOrganizationId: "org-1",
        workflow,
      }).map((item) => [item.legKind, item.operationKind, item.sourceRef]),
    ).toEqual([
      ["payout", "payout", "deal:deal-1:leg:1:payout:1"],
      ["collect", "payin", "deal:deal-1:leg:2:payin:1"],
      ["convert", "fx_conversion", "deal:deal-1:leg:3:fx_conversion:1"],
      [
        "settle_exporter",
        "intercompany_funding",
        "deal:deal-1:leg:4:intercompany_funding:1",
      ],
    ]);
  });

  it("does not duplicate operation materialization on repeated execution requests", async () => {
    const initialWorkflow = createWorkflowProjection({
      acceptedQuoteId: "quote-1",
      type: "currency_exchange",
      withConvert: true,
    });
    const materializedWorkflow = createWorkflowProjection({
      acceptedQuoteId: "quote-1",
      type: "currency_exchange",
      withConvert: true,
      operationRefs: [
        [{ kind: "payin", operationId: "op-1", sourceRef: "deal:deal-1:leg:1:payin:1" }],
        [{ kind: "fx_conversion", operationId: "op-2", sourceRef: "deal:deal-1:leg:2:fx_conversion:1" }],
        [{ kind: "payout", operationId: "op-3", sourceRef: "deal:deal-1:leg:3:payout:1" }],
      ],
      status: "awaiting_funds",
    });
    const findWorkflowById = vi
      .fn()
      .mockResolvedValueOnce(initialWorkflow)
      .mockResolvedValueOnce(materializedWorkflow)
      .mockResolvedValueOnce(materializedWorkflow);
    const createDealLegOperationLinks = vi.fn(async () => undefined);
    const createDealTimelineEvents = vi.fn(async () => undefined);
    const createOrGetPlanned = vi
      .fn()
      .mockResolvedValueOnce({ id: "op-1" })
      .mockResolvedValueOnce({ id: "op-2" })
      .mockResolvedValueOnce({ id: "op-3" });
    const workflow = createDealExecutionWorkflow({
      agreements: {
        agreements: {
          queries: {
            findById: vi.fn(async () => ({ id: "agreement-1", organizationId: "org-1" })),
          },
        },
      } as any,
      currencies: {
        findById: vi.fn(async (id: string) => ({
          code: id === "cur-usd" ? "USD" : "EUR",
          id,
        })),
      } as any,
      db: {
        transaction: vi.fn(async (handler: (tx: any) => Promise<unknown>) =>
          handler({}),
        ),
      } as any,
      idempotency: {
        withIdempotencyTx: vi.fn(async ({ handler }) => handler()),
      } as any,
      createDealStore: () => ({
        createDealLegOperationLinks,
        createDealTimelineEvents,
      }),
      createDealsModule: () => ({
        deals: {
          queries: {
            findWorkflowById,
          },
        },
      } as any),
      createTreasuryModule: () => ({
        operations: {
          commands: {
            createOrGetPlanned,
          },
        },
        quotes: {
          queries: {
            getQuoteDetails: vi.fn(async () => createAcceptedQuoteDetails()),
          },
        },
      } as any),
    });

    await workflow.requestExecution({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
    });
    await workflow.requestExecution({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
    });

    expect(createOrGetPlanned).toHaveBeenCalledTimes(3);
    expect(createDealLegOperationLinks).toHaveBeenCalledTimes(3);
    expect(createDealTimelineEvents).toHaveBeenCalledTimes(1);
  });
});
