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
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Test",
        sourceAmount: "100.00",
        sourceCurrencyId: "cur-usd",
        targetCurrencyId: null,
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
  paymentStepsEnabled: boolean;
  paymentStepsListResult?: { data: unknown[]; total: number };
  workflow: Workflow;
}) {
  const findWorkflowById = vi.fn(async () => input.workflow);
  const listPaymentSteps = vi.fn(async () => ({
    data: input.paymentStepsListResult?.data ?? [],
    limit: 100,
    offset: 0,
    total: input.paymentStepsListResult?.total ?? 0,
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
    paymentStepsEnabled: input.paymentStepsEnabled,
    createDealStore: () => ({
      createDealLegOperationLinks,
      createDealTimelineEvents,
    }),
    createDealsModule: () => ({
      deals: {
        queries: { findWorkflowById },
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
      quotes: {
        queries: { getQuoteDetails: vi.fn(async () => null) },
      },
    }) as any,
  });

  return {
    createDealLegOperationLinks,
    createOrGetPlanned,
    createPaymentStep,
    listPaymentSteps,
    workflow: workflowService,
  };
}

describe("requestExecution flag-aware early exit", () => {
  it("returns early without materializing when flag is on and a step exists", async () => {
    const harness = createHarness({
      paymentStepsEnabled: true,
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
    });
    expect(harness.createOrGetPlanned).not.toHaveBeenCalled();
    expect(harness.createPaymentStep).not.toHaveBeenCalled();
  });

  it("proceeds with materialization when flag is on but no steps exist yet", async () => {
    const harness = createHarness({
      paymentStepsEnabled: true,
      paymentStepsListResult: { data: [], total: 0 },
      workflow: createWorkflowProjection(),
    });

    await harness.workflow.requestExecution({
      actorUserId: "user-1",
      dealId: "deal-1",
      idempotencyKey: "idem-1",
    });

    expect(harness.createOrGetPlanned).toHaveBeenCalled();
    expect(harness.createPaymentStep).toHaveBeenCalled();
  });

  it("ignores step existence check when flag is off", async () => {
    const harness = createHarness({
      paymentStepsEnabled: false,
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

    expect(harness.listPaymentSteps).not.toHaveBeenCalled();
    expect(harness.createOrGetPlanned).toHaveBeenCalled();
    expect(harness.createPaymentStep).not.toHaveBeenCalled();
  });
});

describe("createLegOperation flag-aware early exit", () => {
  it("returns early when flag is on and a step for the leg exists", async () => {
    const harness = createHarness({
      paymentStepsEnabled: true,
      paymentStepsListResult: {
        data: [{ dealLegIdx: 1, id: "step-1" }],
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

  it("proceeds when a step for a different leg exists", async () => {
    const harness = createHarness({
      paymentStepsEnabled: true,
      paymentStepsListResult: {
        data: [{ dealLegIdx: 2, id: "step-2" }],
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

    expect(harness.createOrGetPlanned).toHaveBeenCalled();
    expect(harness.createPaymentStep).toHaveBeenCalled();
  });
});
