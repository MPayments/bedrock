import { describe, expect, it, vi } from "vitest";

import { createDealExecutionWorkflow } from "../src";

type Workflow = ReturnType<typeof createWorkflowProjection>;

function createWorkflowProjection(input?: {
  operationRefs?: {
    kind: string;
    operationId: string;
    sourceRef: string;
  }[][];
}) {
  const operationRefs = input?.operationRefs ?? [[], []];
  const legs = [
    { id: "leg-1", idx: 1, kind: "collect", state: "ready" },
    { id: "leg-2", idx: 2, kind: "payout", state: "pending" },
  ];
  return {
    acceptedQuote: null,
    attachmentIngestions: [],
    executionPlan: legs.map((leg, index) => ({
      ...leg,
      fromCurrencyId: null,
      operationRefs: operationRefs[index] ?? [],
      routeSnapshotLegId: null,
      toCurrencyId: null,
    })),
    fundingResolution: {
      availableMinor: null,
      fundingOrganizationId: null,
      fundingRequisiteId: null,
      reasonCode: "no_convert_leg",
      requiredAmountMinor: null,
      state: "not_applicable" as const,
      strategy: null,
      targetCurrency: null,
      targetCurrencyId: "cur-usd",
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
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Test",
        sourceAmount: "100.00",
        sourceCurrencyId: "cur-usd",
        targetCurrencyId: "cur-usd",
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment" as const,
    },
    nextAction: "Request execution",
    operationalState: { positions: [] },
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
        displayName: "Internal",
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
      status: "submitted",
      type: "payment",
      updatedAt: new Date("2026-04-03T09:00:00.000Z"),
    },
    timeline: [],
    transitionReadiness: [
      {
        allowed: true,
        blockers: [],
        targetStatus: "awaiting_funds",
      },
    ],
  };
}

function createHarness(input: {
  paymentStepsListResult?: { data: unknown[]; total: number };
  quoteExecutionsListResult?: { data: unknown[]; total: number };
  workflow: Workflow;
}) {
  const findWorkflowById = vi.fn(async () => input.workflow);
  const listPaymentSteps = vi.fn(async () => ({
    data: input.paymentStepsListResult?.data ?? [],
    limit: 100,
    offset: 0,
    total: input.paymentStepsListResult?.total ?? 0,
  }));
  const listQuoteExecutions = vi.fn(async () => ({
    data: input.quoteExecutionsListResult?.data ?? [],
    limit: 100,
    offset: 0,
    total: input.quoteExecutionsListResult?.total ?? 0,
  }));
  const createOrGetPlanned = vi.fn(async (req: any) => ({
    amountMinor: req.amountMinor ?? null,
    counterAmountMinor: req.counterAmountMinor ?? null,
    counterCurrencyId: req.counterCurrencyId ?? null,
    currencyId: req.currencyId ?? null,
    customerId: req.customerId ?? null,
    dealId: req.dealId,
    id: req.id,
    internalEntityOrganizationId: req.internalEntityOrganizationId ?? null,
    kind: req.kind,
    quoteId: req.quoteId ?? null,
    sourceRef: req.sourceRef,
    state: "planned",
  }));
  const createPaymentStep = vi.fn(async () => undefined);
  const createDealLegOperationLinks = vi.fn(async () => undefined);
  const createDealTimelineEvents = vi.fn(async () => undefined);

  const workflowService = createDealExecutionWorkflow({
    agreements: {
      agreements: {
        queries: {
          findById: vi.fn(async () => ({
            id: "agreement-1",
            organizationId: "org-1",
          })),
        },
      },
    } as any,
    currencies: {
      findById: vi.fn(async (id: string) => ({ code: "USD", id })),
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
          findPricingContextByDealId: vi.fn(async () => ({
            routeAttachment: null,
            revision: 1,
          })),
          findWorkflowById,
        },
      },
    } as any),
    createReconciliationService: () => ({}) as any,
    createTreasuryModule: () => ({
      instructions: {} as any,
      operations: {
        commands: { createOrGetPlanned },
      },
      paymentSteps: {
        commands: { create: createPaymentStep },
        queries: { list: listPaymentSteps },
      },
      quoteExecutions: {
        commands: { create: vi.fn(async () => undefined) },
        queries: { list: listQuoteExecutions },
      },
      quotes: {
        queries: { getQuoteDetails: vi.fn(async () => null) },
      },
    }) as any,
  });

  return {
    createDealLegOperationLinks,
    createOrGetPlanned,
    createPaymentStep,
    listQuoteExecutions,
    listPaymentSteps,
    workflow: workflowService,
  };
}

describe("requestExecution payment-steps idempotency", () => {
  it("returns early without materializing when an active step already exists", async () => {
    const harness = createHarness({
      paymentStepsListResult: {
        data: [{ id: "step-1" }],
        total: 1,
      },
      workflow: createWorkflowProjection(),
    });

    await harness.workflow.requestExecution({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
    });

    expect(harness.listPaymentSteps).toHaveBeenCalledWith({
      dealId: "deal-1",
      limit: 1,
      offset: 0,
      purpose: "deal_leg",
      state: [
        "draft",
        "scheduled",
        "pending",
        "processing",
        "completed",
        "failed",
        "returned",
      ],
    });
    expect(harness.createOrGetPlanned).not.toHaveBeenCalled();
    expect(harness.createPaymentStep).not.toHaveBeenCalled();
  });

  it("proceeds with materialization when no steps exist yet", async () => {
    const harness = createHarness({
      paymentStepsListResult: { data: [], total: 0 },
      workflow: createWorkflowProjection(),
    });

    await harness.workflow.requestExecution({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
    });

    expect(harness.createPaymentStep).toHaveBeenCalled();
  });

  it("ignores cancelled and skipped steps so a swap+rematerialize cycle creates new drafts", async () => {
    const harness = createHarness({
      // Repository is expected to apply the state filter; with the active-only
      // filter we emulate the post-swap state: zero active rows even though
      // cancelled drafts from the prior route still exist in the table.
      paymentStepsListResult: { data: [], total: 0 },
      workflow: createWorkflowProjection(),
    });

    await harness.workflow.requestExecution({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-after-swap",
    });

    expect(harness.listPaymentSteps).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.arrayContaining(["draft", "scheduled", "processing"]),
      }),
    );
    expect(harness.listPaymentSteps).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.not.arrayContaining(["cancelled"]),
      }),
    );
    expect(harness.listPaymentSteps).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.not.arrayContaining(["skipped"]),
      }),
    );
    expect(harness.createPaymentStep).toHaveBeenCalled();
  });
});

describe("createLegOperation payment-steps idempotency", () => {
  it("returns early when a step for the leg already exists", async () => {
    const harness = createHarness({
      paymentStepsListResult: {
        data: [
          {
            id: "step-1",
            origin: {
              planLegId: "leg-1",
              type: "deal_execution_leg",
            },
          },
        ],
        total: 1,
      },
      workflow: createWorkflowProjection(),
    });

    await harness.workflow.createLegOperation({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
      legId: "leg-1",
    });

    expect(harness.listPaymentSteps).toHaveBeenCalledWith({
      dealId: "deal-1",
      limit: 100,
      offset: 0,
      purpose: "deal_leg",
    });
    expect(harness.createOrGetPlanned).not.toHaveBeenCalled();
    expect(harness.createPaymentStep).not.toHaveBeenCalled();
  });

  it("returns early when a step for the leg is beyond the first page", async () => {
    const harness = createHarness({
      paymentStepsListResult: { data: [], total: 0 },
      workflow: createWorkflowProjection(),
    });
    harness.listPaymentSteps
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => ({
          id: `step-${index}`,
          origin: {
            planLegId: `other-leg-${index}`,
            type: "deal_execution_leg",
          },
          state: "pending",
        })),
        limit: 100,
        offset: 0,
        total: 101,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "step-101",
            origin: {
              planLegId: "leg-1",
              type: "deal_execution_leg",
            },
            state: "pending",
          },
        ],
        limit: 100,
        offset: 100,
        total: 101,
      });

    await harness.workflow.createLegOperation({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
      legId: "leg-1",
    });

    expect(harness.listPaymentSteps).toHaveBeenCalledWith({
      dealId: "deal-1",
      limit: 100,
      offset: 100,
      purpose: "deal_leg",
    });
    expect(harness.createOrGetPlanned).not.toHaveBeenCalled();
    expect(harness.createPaymentStep).not.toHaveBeenCalled();
  });

  it("proceeds when a step for a different leg exists", async () => {
    const harness = createHarness({
      paymentStepsListResult: {
        data: [
          {
            id: "step-2",
            origin: {
              planLegId: "leg-2",
              type: "deal_execution_leg",
            },
          },
        ],
        total: 1,
      },
      workflow: createWorkflowProjection(),
    });

    await harness.workflow.createLegOperation({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
      legId: "leg-1",
    });

    expect(harness.createPaymentStep).toHaveBeenCalled();
  });
});
