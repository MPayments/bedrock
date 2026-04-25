import { describe, expect, it, vi } from "vitest";

import { DealTransitionBlockedError } from "@bedrock/deals";

import {
  compileDealExecutionRecipe,
  createDealExecutionWorkflow,
} from "../src";

function createWorkflowProjection(input?: {
  acceptedQuoteId?: string | null;
  formalDocuments?: {
    approvalStatus: string | null;
    createdAt: Date;
    docType: string;
    id: string;
    lifecycleStatus: string | null;
    occurredAt: Date | null;
    postingStatus: string | null;
    submissionStatus: string | null;
  }[];
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
    fundingResolution: withConvert
      ? {
          availableMinor: null,
          fundingOrganizationId: "org-1",
          fundingRequisiteId: null,
          reasonCode: "inventory_insufficient",
          requiredAmountMinor: "9000",
          state: "resolved" as const,
          strategy: "external_fx" as const,
          targetCurrency: "EUR",
          targetCurrencyId: "currency-eur",
        }
      : {
          availableMinor: null,
          fundingOrganizationId: null,
          fundingRequisiteId: null,
          reasonCode: "no_convert_leg",
          requiredAmountMinor: null,
          state: "not_applicable" as const,
          strategy: null,
          targetCurrency: null,
          targetCurrencyId: null,
        },
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
      formalDocuments: input?.formalDocuments ?? [],
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

function createAcceptanceDocument() {
  return {
    approvalStatus: "approved",
    createdAt: new Date("2026-04-03T12:00:00.000Z"),
    docType: "acceptance",
    id: "document-1",
    lifecycleStatus: "active",
    occurredAt: new Date("2026-04-03T12:00:00.000Z"),
    postingStatus: "posted",
    submissionStatus: "submitted",
  };
}

function createCloseDealHarness(input?: {
  paymentSteps?: {
    dealLegIdx: number;
    id: string;
    kind:
      | "payin"
      | "fx_conversion"
      | "payout"
      | "intracompany_transfer"
      | "intercompany_funding"
      | "internal_transfer";
    state:
      | "draft"
      | "scheduled"
      | "pending"
      | "processing"
      | "completed"
      | "failed"
      | "returned"
      | "cancelled"
      | "skipped";
  }[];
  reconciliationLinks?: {
    exceptions: {
      createdAt: Date;
      externalRecordId: string;
      id: string;
      operationId: string;
      reasonCode: string;
      resolvedAt: Date | null;
      source: string;
      state: "open" | "resolved" | "ignored";
    }[];
    lastActivityAt: Date | null;
    matchCount: number;
    operationId: string;
  }[];
  workflow?: ReturnType<typeof createWorkflowProjection>;
}) {
  const workflow =
    input?.workflow ??
    createWorkflowProjection({
      formalDocuments: [createAcceptanceDocument()],
      operationRefs: [
        [{ kind: "payin", operationId: "op-1", sourceRef: "deal:deal-1:leg:1:payin:1" }],
        [{ kind: "payout", operationId: "op-2", sourceRef: "deal:deal-1:leg:2:payout:1" }],
      ],
      status: "closing_documents",
      type: "payment",
      withConvert: false,
    });
  const transitionStatus = vi.fn(async () => ({
    ...workflow,
    summary: {
      ...workflow.summary,
      status: "done",
    },
  }));
  const createDealTimelineEvents = vi.fn(async () => undefined);
  const workflowService = createDealExecutionWorkflow({
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
      createDealLegOperationLinks: vi.fn(async () => undefined),
      createDealTimelineEvents,
    }),
    createDealsModule: () => ({
      deals: {
        commands: {
          transitionStatus,
        },
        queries: {
          findWorkflowById: vi.fn(async () => workflow),
        },
      },
    } as any),
    createReconciliationService: () => ({
      links: {
        listOperationLinks: vi.fn(
          async () => input?.reconciliationLinks ?? [],
        ),
      },
    } as any),
    createTreasuryModule: () => ({
      operations: {
        commands: {
          createOrGetPlanned: vi.fn(),
        },
      },
      paymentSteps: {
        queries: {
          list: vi.fn(async () => {
            const items = (input?.paymentSteps ?? []).map((step) => ({
              artifacts: [],
              attempts: [],
              completedAt: null,
              createdAt: new Date("2026-04-03T10:00:00.000Z"),
              dealId: "deal-1",
              dealLegIdx: step.dealLegIdx,
              dealLegRole: null,
              failureReason: null,
              fromAmountMinor: null,
              fromCurrencyId: "currency-usd",
              fromParty: { id: "party-1", requisiteId: null },
              id: step.id,
              kind: step.kind,
              postings: [],
              purpose: "deal_leg" as const,
              rate: null,
              scheduledAt: null,
              state: step.state,
              submittedAt: null,
              toAmountMinor: null,
              toCurrencyId: "currency-usd",
              toParty: { id: "party-2", requisiteId: null },
              treasuryBatchId: null,
              updatedAt: new Date("2026-04-03T10:00:00.000Z"),
            }));
            return {
              data: items,
              limit: 100,
              offset: 0,
              total: items.length,
            };
          }),
        },
      },
      quotes: {
        queries: {
          getQuoteDetails: vi.fn(async () => null),
        },
      },
    } as any),
  });

  return {
    createDealTimelineEvents,
    transitionStatus,
    workflow: workflowService,
  };
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

  it("compiles a route-derived multi-hop plan with per-hop quote leg references", () => {
    const multiHopLegs = [
      {
        fromCurrencyId: "cur-rub",
        id: "leg-1",
        idx: 1,
        kind: "collect" as const,
        operationRefs: [] as {
          kind: string;
          operationId: string;
          sourceRef: string;
        }[],
        routeSnapshotLegId: null,
        state: "ready" as const,
        toCurrencyId: "cur-rub",
      },
      {
        fromCurrencyId: "cur-rub",
        id: "leg-2",
        idx: 2,
        kind: "transit_hold" as const,
        operationRefs: [] as {
          kind: string;
          operationId: string;
          sourceRef: string;
        }[],
        routeSnapshotLegId: "route-leg-hop-1",
        state: "pending" as const,
        toCurrencyId: "cur-rub",
      },
      {
        fromCurrencyId: "cur-rub",
        id: "leg-3",
        idx: 3,
        kind: "convert" as const,
        operationRefs: [] as {
          kind: string;
          operationId: string;
          sourceRef: string;
        }[],
        routeSnapshotLegId: "route-leg-hop-2",
        state: "ready" as const,
        toCurrencyId: "cur-aed",
      },
      {
        fromCurrencyId: "cur-aed",
        id: "leg-4",
        idx: 4,
        kind: "transit_hold" as const,
        operationRefs: [] as {
          kind: string;
          operationId: string;
          sourceRef: string;
        }[],
        routeSnapshotLegId: "route-leg-hop-3",
        state: "pending" as const,
        toCurrencyId: "cur-aed",
      },
      {
        fromCurrencyId: "cur-aed",
        id: "leg-5",
        idx: 5,
        kind: "convert" as const,
        operationRefs: [] as {
          kind: string;
          operationId: string;
          sourceRef: string;
        }[],
        routeSnapshotLegId: "route-leg-hop-4",
        state: "ready" as const,
        toCurrencyId: "cur-usd",
      },
      {
        fromCurrencyId: "cur-usd",
        id: "leg-6",
        idx: 6,
        kind: "payout" as const,
        operationRefs: [] as {
          kind: string;
          operationId: string;
          sourceRef: string;
        }[],
        routeSnapshotLegId: null,
        state: "pending" as const,
        toCurrencyId: "cur-usd",
      },
    ];
    const workflow = {
      ...createWorkflowProjection({
        acceptedQuoteId: "quote-1",
        type: "payment",
        withConvert: true,
      }),
      executionPlan: multiHopLegs,
    };
    const acceptedQuote = {
      ...createAcceptedQuoteDetails(),
      legs: [
        {
          asOf: new Date("2026-04-03T10:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          executionCounterpartyId: null,
          fromAmountMinor: 75282514n,
          fromCurrencyId: "cur-rub",
          id: "quote-leg-1",
          idx: 1,
          quoteId: "quote-1",
          rateDen: 1n,
          rateNum: 1n,
          sourceKind: "derived" as const,
          sourceRef: null,
          toAmountMinor: 75282514n,
          toCurrencyId: "cur-rub",
        },
        {
          asOf: new Date("2026-04-03T10:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          executionCounterpartyId: null,
          fromAmountMinor: 75282514n,
          fromCurrencyId: "cur-rub",
          id: "quote-leg-2",
          idx: 2,
          quoteId: "quote-1",
          rateDen: 1000000n,
          rateNum: 48788n,
          sourceKind: "derived" as const,
          sourceRef: null,
          toAmountMinor: 3672500n,
          toCurrencyId: "cur-aed",
        },
        {
          asOf: new Date("2026-04-03T10:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          executionCounterpartyId: null,
          fromAmountMinor: 3672500n,
          fromCurrencyId: "cur-aed",
          id: "quote-leg-3",
          idx: 3,
          quoteId: "quote-1",
          rateDen: 1n,
          rateNum: 1n,
          sourceKind: "derived" as const,
          sourceRef: null,
          toAmountMinor: 3672500n,
          toCurrencyId: "cur-aed",
        },
        {
          asOf: new Date("2026-04-03T10:00:00.000Z"),
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          executionCounterpartyId: null,
          fromAmountMinor: 3672500n,
          fromCurrencyId: "cur-aed",
          id: "quote-leg-4",
          idx: 4,
          quoteId: "quote-1",
          rateDen: 10000n,
          rateNum: 2722n,
          sourceKind: "derived" as const,
          sourceRef: null,
          toAmountMinor: 1000000n,
          toCurrencyId: "cur-usd",
        },
      ],
    };

    const recipe = compileDealExecutionRecipe({
      acceptedQuote,
      agreementOrganizationId: "org-1",
      internalEntityOrganizationId: "org-1",
      workflow,
    });

    expect(
      recipe.map((item) => [
        item.legKind,
        item.amountRef,
        item.counterAmountRef,
        item.quoteLegIdx,
      ]),
    ).toEqual([
      ["collect", "accepted_quote_from", null, null],
      ["transit_hold", "quote_leg_to", null, 1],
      ["convert", "quote_leg_from", "quote_leg_to", 2],
      ["transit_hold", "quote_leg_to", null, 3],
      ["convert", "quote_leg_from", "quote_leg_to", 4],
      ["payout", "accepted_quote_to", null, null],
    ]);

    // Every route-derived leg carries its own unique quoteLegIdx so the
    // two convert legs resolve to DIFFERENT amounts instead of sharing the
    // aggregate quote amounts.
    const convertLegs = recipe.filter((item) => item.legKind === "convert");
    expect(convertLegs).toHaveLength(2);
    expect(convertLegs[0]?.quoteLegIdx).not.toBe(convertLegs[1]?.quoteLegIdx);
  });

  it("throws when there are more route-derived legs than accepted-quote legs", () => {
    const workflow = {
      ...createWorkflowProjection({
        acceptedQuoteId: "quote-1",
        type: "currency_exchange",
        withConvert: true,
      }),
      executionPlan: [
        {
          fromCurrencyId: "cur-rub",
          id: "leg-1",
          idx: 1,
          kind: "collect" as const,
          operationRefs: [],
          routeSnapshotLegId: null,
          state: "ready" as const,
          toCurrencyId: "cur-rub",
        },
        {
          fromCurrencyId: "cur-rub",
          id: "leg-2",
          idx: 2,
          kind: "convert" as const,
          operationRefs: [],
          routeSnapshotLegId: "route-leg-hop-1",
          state: "ready" as const,
          toCurrencyId: "cur-usd",
        },
        {
          fromCurrencyId: "cur-usd",
          id: "leg-3",
          idx: 3,
          kind: "payout" as const,
          operationRefs: [],
          routeSnapshotLegId: null,
          state: "pending" as const,
          toCurrencyId: "cur-usd",
        },
      ],
    };
    // Empty legs array from the existing stub — route-derived leg would need
    // quote leg 1 but the quote has 0 legs.
    expect(() =>
      compileDealExecutionRecipe({
        acceptedQuote: createAcceptedQuoteDetails(),
        agreementOrganizationId: "org-1",
        internalEntityOrganizationId: "org-1",
        workflow,
      }),
    ).toThrow(/more route-derived legs than the accepted quote provides/u);
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
    let opCounter = 0;
    const createOrGetPlanned = vi.fn(async () => {
      opCounter += 1;
      return { id: `op-${opCounter}` };
    });
    const listPaymentSteps = vi
      .fn()
      .mockResolvedValueOnce({ data: [], limit: 1, offset: 0, total: 0 })
      .mockResolvedValue({
        data: [{ id: "step-1" }],
        limit: 1,
        offset: 0,
        total: 1,
      });
    const createPaymentStep = vi.fn(async () => undefined);
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
      createReconciliationService: () => ({
        links: {
          listOperationLinks: vi.fn(async () => []),
        },
      } as any),
      createTreasuryModule: () => ({
        operations: {
          commands: {
            createOrGetPlanned,
          },
        },
        paymentSteps: {
          commands: {
            create: createPaymentStep,
          },
          queries: {
            list: listPaymentSteps,
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

    expect(createDealTimelineEvents).toHaveBeenCalledTimes(1);
  });

  it("rejects closeDeal while reconciliation is still pending", async () => {
    const harness = createCloseDealHarness({
      paymentSteps: [
        { dealLegIdx: 1, id: "op-1", kind: "payin", state: "cancelled" },
        { dealLegIdx: 2, id: "op-2", kind: "payout", state: "completed" },
      ],
      reconciliationLinks: [],
    });

    await expect(
      harness.workflow.closeDeal({
        actorUserId: "user-1",
        comment: "Close ready deal",
        dealId: "deal-1",
        idempotencyKey: "close-1",
      }),
    ).rejects.toBeInstanceOf(DealTransitionBlockedError);

    expect(harness.transitionStatus).not.toHaveBeenCalled();
  });

  it("rejects closeDeal when reconciliation has open exceptions", async () => {
    const harness = createCloseDealHarness({
      paymentSteps: [
        { dealLegIdx: 1, id: "op-1", kind: "payin", state: "cancelled" },
        { dealLegIdx: 2, id: "op-2", kind: "payout", state: "completed" },
      ],
      reconciliationLinks: [
        {
          exceptions: [
            {
              createdAt: new Date("2026-04-03T11:00:00.000Z"),
              externalRecordId: "external-1",
              id: "exception-1",
              operationId: "op-2",
              reasonCode: "no_match",
              resolvedAt: null,
              source: "bank_statement",
              state: "open",
            },
          ],
          lastActivityAt: new Date("2026-04-03T11:00:00.000Z"),
          matchCount: 0,
          operationId: "op-2",
        },
      ],
    });

    await expect(
      harness.workflow.closeDeal({
        actorUserId: "user-1",
        comment: "Close blocked deal",
        dealId: "deal-1",
        idempotencyKey: "close-2",
      }),
    ).rejects.toBeInstanceOf(DealTransitionBlockedError);

    expect(harness.transitionStatus).not.toHaveBeenCalled();
  });

  it("closes the deal once reconciliation-aware readiness is satisfied", async () => {
    const harness = createCloseDealHarness({
      paymentSteps: [
        { dealLegIdx: 1, id: "op-1", kind: "payin", state: "cancelled" },
        { dealLegIdx: 2, id: "op-2", kind: "payout", state: "completed" },
      ],
      reconciliationLinks: [
        {
          exceptions: [],
          lastActivityAt: new Date("2026-04-03T11:00:00.000Z"),
          matchCount: 1,
          operationId: "op-2",
        },
      ],
    });

    const result = await harness.workflow.closeDeal({
      actorUserId: "user-1",
      comment: "Close ready deal",
      dealId: "deal-1",
      idempotencyKey: "close-3",
    });

    expect(result.summary.status).toBe("done");
    expect(harness.transitionStatus).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: "Close ready deal",
      dealId: "deal-1",
      status: "done",
    });
    expect(harness.createDealTimelineEvents).toHaveBeenCalledTimes(1);
  });

  it("resolves blocked legs by clearing the manual override without emitting a separate blocker event", async () => {
    const blockedWorkflow = createWorkflowProjection({
      status: "awaiting_payment",
      type: "payment",
      withConvert: false,
    });
    blockedWorkflow.executionPlan = blockedWorkflow.executionPlan.map(
      (leg: (typeof blockedWorkflow.executionPlan)[number]) =>
        leg.kind === "payout" ? { ...leg, state: "blocked" } : leg,
    );
    // After the override is cleared the leg re-derives its state from
    // instruction + doc data; for this payment scenario that's `pending`
    // because no instructions have been settled yet.
    const resolvedWorkflow = {
      ...blockedWorkflow,
      executionPlan: blockedWorkflow.executionPlan.map(
        (leg: (typeof blockedWorkflow.executionPlan)[number]) =>
          leg.kind === "payout" ? { ...leg, state: "pending" } : leg,
      ),
    };
    const setLegManualOverride = vi.fn(async () => resolvedWorkflow);
    const createDealTimelineEvents = vi.fn(async () => undefined);
    const workflow = createDealExecutionWorkflow({
      agreements: {
        agreements: {
          queries: {
            findById: vi.fn(),
          },
        },
      } as any,
      currencies: {
        findById: vi.fn(),
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
        createDealLegOperationLinks: vi.fn(),
        createDealTimelineEvents,
      }),
      createDealsModule: () => ({
        deals: {
          commands: {
            setLegManualOverride,
          },
          queries: {
            findWorkflowById: vi.fn(async () => blockedWorkflow),
          },
        },
      } as any),
      createReconciliationService: () => ({
        links: {
          listOperationLinks: vi.fn(),
        },
      } as any),
      createTreasuryModule: () => ({
        instructions: {
          queries: {
            listLatestByOperationIds: vi.fn(),
          },
        },
        operations: {
          commands: {
            createOrGetPlanned: vi.fn(),
          },
        },
        quotes: {
          queries: {
            getQuoteDetails: vi.fn(),
          },
        },
      } as any),
    });

    const result = await workflow.resolveExecutionBlocker({
      actorUserId: "user-1",
      comment: "Retry payout",
      dealId: "deal-1",
      idempotencyKey: "resolve-1",
      legId: "leg-2",
    });

    expect(setLegManualOverride).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: "Retry payout",
      dealId: "deal-1",
      idx: 2,
      override: null,
    });
    expect(createDealTimelineEvents).not.toHaveBeenCalled();
    expect(result.executionPlan.at(-1)?.state).toBe("pending");
  });

});
