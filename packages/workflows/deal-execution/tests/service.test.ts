import { describe, expect, it, vi } from "vitest";

import { DealTransitionBlockedError } from "@bedrock/deals";

import {
  compileDealExecutionRecipe,
  compileRouteExecutionRecipe,
  createDealExecutionWorkflow,
} from "../src";

type ExecutionRecipeRoute = Parameters<typeof compileRouteExecutionRecipe>[0]["route"];

function createWorkflowProjection(input?: {
  sourceQuoteId?: string | null;
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
    acceptedCalculation: input?.sourceQuoteId
      ? {
          acceptedAt: new Date("2026-04-03T10:00:00.000Z"),
          calculationId: "calc-1",
          calculationTimestamp: new Date("2026-04-03T10:00:00.000Z"),
          pricingProvenance: null,
          quoteProvenance: {
            fxQuoteId: input.sourceQuoteId,
            quoteSnapshot: null,
            sourceQuoteId: input.sourceQuoteId,
          },
          routeVersionId: null,
          snapshotId: "calc-snapshot-1",
          state: "accepted",
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
    header: {
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
      calculationId: input?.sourceQuoteId ? "calc-1" : null,
      createdAt: new Date("2026-04-03T09:00:00.000Z"),
      id: "deal-1",
      status: input?.status ?? "approved_for_execution",
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
        targetStatus: "approved_for_execution",
      },
    ],
  } as any;
}

function createCurrentCalculationRecord(input?: {
  fxQuoteId?: string | null;
  routeSnapshot?: unknown;
  state?: string;
}) {
  return {
    currentSnapshot: {
      baseCurrencyId: "cur-eur",
      calculationCurrencyId: "cur-usd",
      fxQuoteId: input?.fxQuoteId ?? "quote-1",
      originalAmountMinor: "10000",
      routeSnapshot: input?.routeSnapshot ?? null,
      state: input?.state ?? "accepted",
      totalInBaseMinor: "9000",
    },
    id: "calc-1",
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
      status: "reconciling",
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
          status: "reconciling",
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
      status: "closed",
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
          listCashMovements: vi.fn(async () => ({
            data:
              input?.operationFacts?.map((fact, index) => ({
                accountRef: null,
                amountMinor: "1",
                bookedAt: new Date("2026-04-03T10:00:00.000Z"),
                calculationSnapshotId: null,
                confirmedAt: null,
                createdAt: new Date("2026-04-03T10:00:00.000Z"),
                currencyId: "cur-usd",
                dealId: "deal-1",
                direction: "debit",
                externalRecordId: null,
                id: `cash-${index + 1}`,
                instructionId: null,
                metadata: null,
                notes: null,
                operationId: fact.operationId,
                providerCounterpartyId: null,
                providerRef: null,
                requisiteId: null,
                routeLegId: null,
                routeVersionId: null,
                sourceKind: "provider",
                sourceRef: `cash:${index + 1}`,
                statementRef: null,
                updatedAt: new Date("2026-04-03T10:00:00.000Z"),
                valueDate: null,
              })) ?? [],
            limit: 1000,
            offset: 0,
            total: input?.operationFacts?.length ?? 0,
          })),
          listExecutionFees: vi.fn(async () => ({
            data: [],
            limit: 1000,
            offset: 0,
            total: 0,
          })),
          listExecutionFills: vi.fn(async () => ({
            data: [],
            limit: 1000,
            offset: 0,
            total: 0,
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
        agreementOrganizationId: "org-1",
        currentCalculation: null,
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
      sourceQuoteId: "quote-1",
      type: "currency_exchange",
      withConvert: true,
    });

    expect(
      compileDealExecutionRecipe({
        agreementOrganizationId: "org-1",
        currentCalculation: createCurrentCalculationRecord(),
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
      sourceQuoteId: "quote-1",
      type: "currency_transit",
      withConvert: true,
    });

    expect(
      compileDealExecutionRecipe({
        agreementOrganizationId: "org-1",
        currentCalculation: createCurrentCalculationRecord(),
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
      sourceQuoteId: "quote-1",
      type: "exporter_settlement",
      withConvert: true,
    });

    expect(
      compileDealExecutionRecipe({
        agreementOrganizationId: "org-external",
        currentCalculation: createCurrentCalculationRecord(),
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
        currentCalculation: null,
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
      sourceQuoteId: "quote-1",
      type: "currency_exchange",
      withConvert: true,
    });
    const materializedWorkflow = createWorkflowProjection({
      sourceQuoteId: "quote-1",
      type: "currency_exchange",
      withConvert: true,
      operationRefs: [
        [{ kind: "payin", operationId: "op-1", sourceRef: "deal:deal-1:leg:1:payin:1" }],
        [{ kind: "fx_conversion", operationId: "op-2", sourceRef: "deal:deal-1:leg:2:fx_conversion:1" }],
        [{ kind: "payout", operationId: "op-3", sourceRef: "deal:deal-1:leg:3:payout:1" }],
      ],
      status: "approved_for_execution",
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
      calculations: {
        calculations: {
          queries: {
            findById: vi.fn(async () => createCurrentCalculationRecord()),
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
            getQuoteDetails: vi.fn(async () => null),
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
      status: "approved_for_execution",
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

    expect(result.summary.status).toBe("closed");
    expect(harness.transitionStatus).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: "Close ready deal",
      dealId: "deal-1",
      status: "closed",
    });
    expect(harness.createDealTimelineEvents).toHaveBeenCalledTimes(1);
  });

  it("resolves blocked legs through updateLegState without emitting a separate blocker event", async () => {
    const blockedWorkflow = createWorkflowProjection({
      status: "executing",
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
      status: "executing",
      type: "payment",
      withConvert: false,
    });
    const ingestExternalRecord = vi.fn(async () => undefined);
    const recordCashMovement = vi.fn(async () => undefined);
    const recordExecutionFee = vi.fn(async () => undefined);
    const recordExecutionFill = vi.fn(async () => undefined);
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
            recordCashMovement,
            recordExecutionFee,
            recordExecutionFill,
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

    expect(recordExecutionFill).not.toHaveBeenCalled();
    expect(recordCashMovement).toHaveBeenCalledWith({
      accountRef: null,
      amountMinor: 9950n,
      bookedAt: new Date("2026-04-03T10:05:00.000Z"),
      calculationSnapshotId: null,
      confirmedAt: new Date("2026-04-03T10:05:00.000Z"),
      currencyId: "cur-usd",
      direction: "debit",
      externalRecordId: "statement-1",
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
      providerCounterpartyId: null,
      providerRef: "provider-ref-1",
      requisiteId: null,
      routeLegId: "route-leg-1",
      routeVersionId: null,
      sourceKind: "provider",
      sourceRef: "treasury-instruction-outcome:instruction-1:settled:cash",
      statementRef: null,
      valueDate: new Date("2026-04-03T10:05:00.000Z"),
    });
    expect(recordExecutionFee).toHaveBeenCalledWith({
      amountMinor: 50n,
      calculationSnapshotId: null,
      chargedAt: new Date("2026-04-03T10:05:00.000Z"),
      componentCode: null,
      confirmedAt: new Date("2026-04-03T10:05:00.000Z"),
      currencyId: "cur-usd",
      externalRecordId: "statement-1",
      feeFamily: "provider_fee",
      fillId: null,
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
      providerCounterpartyId: null,
      providerRef: "provider-ref-1",
      routeComponentId: null,
      routeLegId: "route-leg-1",
      routeVersionId: null,
      sourceKind: "provider",
      sourceRef: "treasury-instruction-outcome:instruction-1:settled:fee",
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
