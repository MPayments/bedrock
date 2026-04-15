import { describe, expect, it, vi } from "vitest";

import { DealTransitionBlockedError } from "@bedrock/deals";

import {
  compileDealExecutionRecipe,
  compileRouteExecutionRecipe,
  createDealExecutionWorkflow,
} from "../src";

type ExecutionRecipeRoute = Parameters<typeof compileRouteExecutionRecipe>[0]["route"];

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

function createExecutionRouteSnapshot(input?: {
  withFx?: boolean;
  withInternalTransfer?: boolean;
}): ExecutionRecipeRoute {
  const withFx = input?.withFx ?? false;
  const withInternalTransfer = input?.withInternalTransfer ?? false;
  const legs: ExecutionRecipeRoute["legs"] = [
    {
      code: "route-leg-1",
      expectedFromAmountMinor: "10000",
      expectedToAmountMinor: "10000",
      fromCurrencyId: "cur-usd",
      id: "route-leg-1",
      idx: 1,
      kind: "collection" as const,
      toCurrencyId: "cur-usd",
    },
    ...(withFx
      ? [
          {
            code: "route-leg-2",
            expectedFromAmountMinor: "10000",
            expectedToAmountMinor: "9000",
            fromCurrencyId: "cur-usd",
            id: "route-leg-2",
            idx: 2,
            kind: "fx_conversion" as const,
            toCurrencyId: "cur-eur",
          },
        ]
      : []),
    ...(withInternalTransfer
      ? [
          {
            code: "route-leg-transfer",
            expectedFromAmountMinor: withFx ? "9000" : "10000",
            expectedToAmountMinor: withFx ? "9000" : "10000",
            fromCurrencyId: withFx ? "cur-eur" : "cur-usd",
            id: "route-leg-transfer",
            idx: withFx ? 3 : 2,
            kind: "intracompany_transfer" as const,
            toCurrencyId: withFx ? "cur-eur" : "cur-usd",
          },
        ]
      : []),
    {
      code: "route-leg-payout",
      expectedFromAmountMinor: withFx ? "9000" : "10000",
      expectedToAmountMinor: withFx ? "9000" : "10000",
      fromCurrencyId: withFx ? "cur-eur" : "cur-usd",
      id: "route-leg-payout",
      idx: withFx ? (withInternalTransfer ? 4 : 3) : withInternalTransfer ? 3 : 2,
      kind: "payout" as const,
      toCurrencyId: withFx ? "cur-eur" : "cur-usd",
    },
  ];

  return {
    id: "route-version-1",
    legs,
    routeId: "route-1",
    version: 1,
  };
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
  latestInstructions?: {
    attempt: number;
    createdAt: Date;
    id: string;
    operationId: string;
    providerRef: string | null;
    providerSnapshot: Record<string, unknown> | null;
    sourceRef: string;
    state:
      | "prepared"
      | "submitted"
      | "settled"
      | "failed"
      | "voided"
      | "return_requested"
      | "returned";
    updatedAt: Date;
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
  operationFacts?: {
    operationId: string;
  }[];
  workflow?: ReturnType<typeof createWorkflowProjection>;
}) {
  const workflow =
    input?.workflow ??
    {
      ...createWorkflowProjection({
      formalDocuments: [createAcceptanceDocument()],
      operationRefs: [
        [{ kind: "payin", operationId: "op-1", sourceRef: "deal:deal-1:leg:1:payin:1" }],
        [{ kind: "payout", operationId: "op-2", sourceRef: "deal:deal-1:leg:2:payout:1" }],
      ],
      status: "closing_documents",
      type: "payment",
      withConvert: false,
      }),
      summary: {
        ...createWorkflowProjection({
          formalDocuments: [createAcceptanceDocument()],
          operationRefs: [
            [{ kind: "payin", operationId: "op-1", sourceRef: "deal:deal-1:leg:1:payin:1" }],
            [{ kind: "payout", operationId: "op-2", sourceRef: "deal:deal-1:leg:2:payout:1" }],
          ],
          status: "closing_documents",
          type: "payment",
          withConvert: false,
        }).summary,
        calculationId: "calculation-1",
      },
    };
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
      instructions: {
        queries: {
          listLatestByOperationIds: vi.fn(
            async () => input?.latestInstructions ?? [],
          ),
        },
      },
      operations: {
        commands: {
          createOrGetPlanned: vi.fn(),
        },
        queries: {
          listFacts: vi.fn(async () => ({
            data:
              input?.operationFacts?.map((fact, index) => ({
                amountMinor: null,
                confirmedAt: null,
                counterAmountMinor: null,
                counterCurrencyId: null,
                createdAt: new Date("2026-04-03T10:00:00.000Z"),
                currencyId: null,
                dealId: "deal-1",
                externalRecordId: null,
                feeAmountMinor: null,
                feeCurrencyId: null,
                id: `fact-${index + 1}`,
                instructionId: null,
                metadata: null,
                notes: null,
                operationId: fact.operationId,
                providerRef: null,
                recordedAt: new Date("2026-04-03T10:00:00.000Z"),
                routeLegId: null,
                sourceKind: "provider",
                sourceRef: `fact:${index + 1}`,
                updatedAt: new Date("2026-04-03T10:00:00.000Z"),
              })) ?? [],
            limit: 1000,
            offset: 0,
            total: input?.operationFacts?.length ?? 0,
          })),
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

  it("compiles route-driven payment execution and links internal transfer into the payout bucket", () => {
    const workflow = createWorkflowProjection({
      type: "payment",
      withConvert: false,
    });
    const route = createExecutionRouteSnapshot({
      withInternalTransfer: true,
    });

    expect(
      compileRouteExecutionRecipe({
        acceptedQuote: null,
        route,
        workflow,
      }).map((item) => [item.legKind, item.operationKind, item.legId, item.sourceRef]),
    ).toEqual([
      ["collect", "payin", "leg-1", "deal:deal-1:route-leg:route-leg-1:payin:1"],
      [
        "payout",
        "intracompany_transfer",
        "leg-2",
        "deal:deal-1:route-leg:route-leg-transfer:intracompany_transfer:1",
      ],
      ["payout", "payout", "leg-2", "deal:deal-1:route-leg:route-leg-payout:payout:1"],
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

  it("materializes only missing route-driven operations and prefers the accepted calculation snapshot route", async () => {
    const initialWorkflow = createWorkflowProjection({
      type: "payment",
      withConvert: false,
      operationRefs: [
        [
          {
            kind: "payin",
            operationId: "op-1",
            sourceRef: "deal:deal-1:route-leg:route-leg-1:payin:1",
          },
        ],
        [
          {
            kind: "intracompany_transfer",
            operationId: "op-2",
            sourceRef:
              "deal:deal-1:route-leg:route-leg-transfer:intracompany_transfer:1",
          },
        ],
      ],
    });
    const materializedWorkflow = createWorkflowProjection({
      type: "payment",
      withConvert: false,
      operationRefs: [
        [
          {
            kind: "payin",
            operationId: "op-1",
            sourceRef: "deal:deal-1:route-leg:route-leg-1:payin:1",
          },
        ],
        [
          {
            kind: "intracompany_transfer",
            operationId: "op-2",
            sourceRef:
              "deal:deal-1:route-leg:route-leg-transfer:intracompany_transfer:1",
          },
          {
            kind: "payout",
            operationId: "op-3",
            sourceRef: "deal:deal-1:route-leg:route-leg-payout:payout:1",
          },
        ],
      ],
      status: "awaiting_funds",
    });
    const acceptedRouteSnapshot = createExecutionRouteSnapshot({
      withInternalTransfer: true,
    });
    const findWorkflowById = vi
      .fn()
      .mockResolvedValueOnce(initialWorkflow)
      .mockResolvedValueOnce(materializedWorkflow);
    const createDealLegOperationLinks = vi.fn(async () => undefined);
    const createDealTimelineEvents = vi.fn(async () => undefined);
    const createOrGetPlanned = vi.fn().mockResolvedValueOnce({ id: "op-3" });
    const workflow = createDealExecutionWorkflow({
      agreements: {
        agreements: {
          queries: {
            findById: vi.fn(async () => ({ id: "agreement-1", organizationId: "org-1" })),
          },
        },
      } as any,
      calculations: {
        calculations: {
          queries: {
            findById: vi.fn(async () => ({
              currentSnapshot: {
                routeSnapshot: acceptedRouteSnapshot,
                state: "accepted",
              },
              id: "calc-1",
            })),
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
            findCurrentRouteByDealId: vi.fn(async () =>
              createExecutionRouteSnapshot({ withInternalTransfer: false }),
            ),
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
        quotes: {
          queries: {
            getQuoteDetails: vi.fn(async () => null),
          },
        },
      } as any),
    });

    const result = await workflow.requestExecution({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-route-1",
    });

    expect(createOrGetPlanned).toHaveBeenCalledTimes(1);
    expect(createOrGetPlanned).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 10000n,
        currencyId: "cur-usd",
        kind: "payout",
        routeLegId: "route-leg-payout",
        sourceRef: "deal:deal-1:route-leg:route-leg-payout:payout:1",
      }),
    );
    expect(createDealLegOperationLinks).toHaveBeenCalledWith([
      expect.objectContaining({
        dealLegId: "leg-2",
        operationKind: "payout",
        sourceRef: "deal:deal-1:route-leg:route-leg-payout:payout:1",
      }),
    ]);
    expect(createDealTimelineEvents).not.toHaveBeenCalled();
    expect(result.executionPlan[1]?.operationRefs).toHaveLength(2);
  });

  it("rejects closeDeal while reconciliation is still pending", async () => {
    const harness = createCloseDealHarness({
      latestInstructions: [
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          id: "instruction-1",
          operationId: "op-1",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-1",
          state: "voided",
          updatedAt: new Date("2026-04-03T10:00:00.000Z"),
        },
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:05:00.000Z"),
          id: "instruction-2",
          operationId: "op-2",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-2",
          state: "settled",
          updatedAt: new Date("2026-04-03T10:05:00.000Z"),
        },
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
      latestInstructions: [
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          id: "instruction-1",
          operationId: "op-1",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-1",
          state: "voided",
          updatedAt: new Date("2026-04-03T10:00:00.000Z"),
        },
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:05:00.000Z"),
          id: "instruction-2",
          operationId: "op-2",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-2",
          state: "settled",
          updatedAt: new Date("2026-04-03T10:05:00.000Z"),
        },
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

  it("rejects closeDeal when realized profitability facts are missing", async () => {
    const harness = createCloseDealHarness({
      latestInstructions: [
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          id: "instruction-1",
          operationId: "op-1",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-1",
          state: "voided",
          updatedAt: new Date("2026-04-03T10:00:00.000Z"),
        },
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:05:00.000Z"),
          id: "instruction-2",
          operationId: "op-2",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-2",
          state: "settled",
          updatedAt: new Date("2026-04-03T10:05:00.000Z"),
        },
      ],
      operationFacts: [],
      reconciliationLinks: [
        {
          exceptions: [],
          lastActivityAt: new Date("2026-04-03T11:00:00.000Z"),
          matchCount: 1,
          operationId: "op-2",
        },
      ],
    });

    await expect(
      harness.workflow.closeDeal({
        actorUserId: "user-1",
        comment: "Close blocked deal",
        dealId: "deal-1",
        idempotencyKey: "close-profitability-1",
      }),
    ).rejects.toBeInstanceOf(DealTransitionBlockedError);

    expect(harness.transitionStatus).not.toHaveBeenCalled();
  });

  it("closes the deal once reconciliation-aware readiness is satisfied", async () => {
    const harness = createCloseDealHarness({
      latestInstructions: [
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          id: "instruction-1",
          operationId: "op-1",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-1",
          state: "voided",
          updatedAt: new Date("2026-04-03T10:00:00.000Z"),
        },
        {
          attempt: 1,
          createdAt: new Date("2026-04-03T10:05:00.000Z"),
          id: "instruction-2",
          operationId: "op-2",
          providerRef: null,
          providerSnapshot: null,
          sourceRef: "source-2",
          state: "settled",
          updatedAt: new Date("2026-04-03T10:05:00.000Z"),
        },
      ],
      reconciliationLinks: [
        {
          exceptions: [],
          lastActivityAt: new Date("2026-04-03T11:00:00.000Z"),
          matchCount: 1,
          operationId: "op-2",
        },
      ],
      operationFacts: [{ operationId: "op-2" }],
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

  it("resolves blocked legs through updateLegState without emitting a separate blocker event", async () => {
    const blockedWorkflow = createWorkflowProjection({
      status: "awaiting_payment",
      type: "payment",
      withConvert: false,
    });
    blockedWorkflow.executionPlan = blockedWorkflow.executionPlan.map(
      (leg: (typeof blockedWorkflow.executionPlan)[number]) =>
        leg.kind === "payout" ? { ...leg, state: "blocked" } : leg,
    );
    const resolvedWorkflow = {
      ...blockedWorkflow,
      executionPlan: blockedWorkflow.executionPlan.map(
        (leg: (typeof blockedWorkflow.executionPlan)[number]) =>
          leg.kind === "payout" ? { ...leg, state: "ready" } : leg,
      ),
    };
    const updateLegState = vi.fn(async () => resolvedWorkflow);
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
            updateLegState,
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

    expect(updateLegState).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: "Retry payout",
      dealId: "deal-1",
      idx: 2,
      state: "ready",
    });
    expect(createDealTimelineEvents).not.toHaveBeenCalled();
    expect(result.executionPlan.at(-1)?.state).toBe("ready");
  });

  it("ingests a treasury settlement reconciliation record when an instruction reaches a terminal outcome", async () => {
    const workflowProjection = createWorkflowProjection({
      operationRefs: [
        [
          {
            kind: "payin",
            operationId: "op-1",
            sourceRef: "deal:deal-1:leg:1:payin:1",
          },
        ],
        [],
      ],
      status: "awaiting_payment",
      type: "payment",
      withConvert: false,
    });
    const ingestExternalRecord = vi.fn(async () => undefined);
    const recordActualFact = vi.fn(async () => undefined);
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
          queries: {
            findWorkflowById: vi.fn(async () => workflowProjection),
          },
        },
      } as any),
      createReconciliationService: () => ({
        links: {
          listOperationLinks: vi.fn(async () => []),
        },
        records: {
          ingestExternalRecord,
        },
      } as any),
      createTreasuryModule: () => ({
        instructions: {
          commands: {
            recordOutcome: vi.fn(async () => ({
              attempt: 1,
              createdAt: new Date("2026-04-03T10:00:00.000Z"),
              failedAt: null,
              id: "instruction-1",
              operationId: "op-1",
              providerRef: "provider-ref-1",
              providerSnapshot: {
                amountMinor: "9950",
                externalRecordId: "statement-1",
                feeAmountMinor: "50",
                providerStatus: "settled",
              },
              returnRequestedAt: null,
              returnedAt: null,
              settledAt: new Date("2026-04-03T10:05:00.000Z"),
              sourceRef: "source-1",
              state: "settled",
              submittedAt: new Date("2026-04-03T10:01:00.000Z"),
              updatedAt: new Date("2026-04-03T10:05:00.000Z"),
              voidedAt: null,
            })),
          },
          queries: {
            findById: vi.fn(async () => ({
              attempt: 1,
              createdAt: new Date("2026-04-03T10:00:00.000Z"),
              failedAt: null,
              id: "instruction-1",
              operationId: "op-1",
              providerRef: null,
              providerSnapshot: null,
              returnRequestedAt: null,
              returnedAt: null,
              settledAt: null,
              sourceRef: "source-1",
              state: "submitted",
              submittedAt: new Date("2026-04-03T10:01:00.000Z"),
              updatedAt: new Date("2026-04-03T10:01:00.000Z"),
              voidedAt: null,
            })),
          },
        },
        operations: {
          commands: {
            recordActualFact,
          },
          queries: {
            findById: vi.fn(async () => ({
              counterCurrencyId: null,
              currencyId: "cur-usd",
              dealId: "deal-1",
              id: "op-1",
              kind: "payout",
              routeLegId: "route-leg-1",
            })),
          },
        },
        quotes: {
          queries: {
            getQuoteDetails: vi.fn(async () => null),
          },
        },
      } as any),
    });

    await workflow.recordInstructionOutcome({
      actorUserId: "user-1",
      idempotencyKey: "record-outcome-1",
      instructionId: "instruction-1",
      outcome: "settled",
      providerRef: "provider-ref-1",
      providerSnapshot: { providerStatus: "settled" },
    });

    expect(recordActualFact).toHaveBeenCalledWith({
      amountMinor: 9950n,
      confirmedAt: new Date("2026-04-03T10:05:00.000Z"),
      counterAmountMinor: null,
      counterCurrencyId: null,
      currencyId: "cur-usd",
      externalRecordId: "statement-1",
      feeAmountMinor: 50n,
      feeCurrencyId: "cur-usd",
      instructionId: "instruction-1",
      metadata: {
        instructionState: "settled",
        providerSnapshot: {
          amountMinor: "9950",
          externalRecordId: "statement-1",
          feeAmountMinor: "50",
          providerStatus: "settled",
        },
      },
      notes: "Instruction outcome: settled",
      operationId: "op-1",
      providerRef: "provider-ref-1",
      recordedAt: new Date("2026-04-03T10:05:00.000Z"),
      routeLegId: "route-leg-1",
      sourceKind: "provider",
      sourceRef: "treasury-instruction-outcome:instruction-1:settled",
    });
    expect(ingestExternalRecord).toHaveBeenCalledWith({
      actorUserId: "user-1",
      idempotencyKey: "reconciliation:auto:instruction-1:settled",
      normalizationVersion: 1,
      normalizedPayload: {
        dealId: "deal-1",
        instructionId: "instruction-1",
        instructionState: "settled",
        operationId: "op-1",
        operationKind: "treasury",
        skipExecutionFactNormalization: true,
        treasuryOperationKind: "payout",
      },
      rawPayload: {
        dealId: "deal-1",
        instructionId: "instruction-1",
        instructionState: "settled",
        operationId: "op-1",
        operationKind: "payout",
        providerRef: "provider-ref-1",
        providerSnapshot: {
          amountMinor: "9950",
          externalRecordId: "statement-1",
          feeAmountMinor: "50",
          providerStatus: "settled",
        },
      },
      source: "treasury_instruction_outcomes",
      sourceRecordId: "instruction-1:settled",
    });
  });
});
