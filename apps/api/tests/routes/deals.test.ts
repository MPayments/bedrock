import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  authByAudience: {
    crm: {
      api: {
        userHasPermission,
      },
    },
    finance: {
      api: {
        userHasPermission,
      },
    },
    portal: {
      api: {
        userHasPermission,
      },
    },
  },
}));

import {
  DealNotFoundError,
  DealTransitionBlockedError,
} from "@bedrock/deals";

import { dealsRoutes } from "../../src/routes/deals";

function createDealDetail() {
  const now = new Date("2026-03-30T00:00:00.000Z");

  return {
    id: "00000000-0000-4000-8000-000000000010",
    customerId: "00000000-0000-4000-8000-000000000001",
    agreementId: "00000000-0000-4000-8000-000000000002",
    calculationId: "00000000-0000-4000-8000-000000000003",
    type: "payment" as const,
    status: "draft" as const,
    comment: "Draft payment deal",
    createdAt: now,
    updatedAt: now,
    legs: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        idx: 1,
        kind: "payment" as const,
        status: "draft" as const,
        createdAt: now,
        updatedAt: now,
      },
    ],
    participants: [
      {
        id: "00000000-0000-4000-8000-000000000012",
        role: "customer" as const,
        partyId: "00000000-0000-4000-8000-000000000001",
        customerId: "00000000-0000-4000-8000-000000000001",
        organizationId: null,
        counterpartyId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    statusHistory: [
      {
        id: "00000000-0000-4000-8000-000000000013",
        status: "draft" as const,
        changedBy: "user-1",
        comment: "Draft payment deal",
        createdAt: now,
      },
    ],
    approvals: [],
  };
}

function createDealsModuleStub() {
  return {
    deals: {
      queries: {
        findWorkflowById: vi.fn(),
        list: vi.fn(),
        findById: vi.fn(),
        listCalculationHistory: vi.fn(),
      },
      commands: {
        acceptQuote: vi.fn(),
        create: vi.fn(),
        transitionStatus: vi.fn(),
        updateLegState: vi.fn(),
      },
    },
  };
}

function createWorkflowProjection() {
  const now = new Date("2026-03-30T00:00:00.000Z");

  return {
    acceptedQuote: null,
    executionPlan: [
      { idx: 1, kind: "collect" as const, state: "ready" as const },
      { idx: 2, kind: "payout" as const, state: "pending" as const },
    ],
    intake: {
      common: {
        applicantCounterpartyId: "00000000-0000-4000-8000-000000000004",
        customerNote: "Draft payment deal",
        requestedExecutionDate: now,
      },
      externalBeneficiary: {
        bankInstructionSnapshot: null,
        beneficiaryCounterpartyId: "00000000-0000-4000-8000-000000000005",
        beneficiarySnapshot: null,
      },
      incomingReceipt: {
        contractNumber: null,
        expectedAmount: null,
        expectedAt: null,
        expectedCurrencyId: null,
        invoiceNumber: null,
        payerCounterpartyId: null,
        payerSnapshot: null,
      },
      moneyRequest: {
        purpose: "Supplier payment",
        sourceAmount: "100.00",
        sourceCurrencyId: "00000000-0000-4000-8000-000000000006",
        targetCurrencyId: null,
      },
      settlementDestination: {
        bankInstructionSnapshot: null,
        mode: null,
        requisiteId: null,
      },
      type: "payment" as const,
    },
    nextAction: "Update execution leg state",
    operationalState: {
      capabilities: [],
      positions: [],
    },
    participants: [
      {
        counterpartyId: null,
        customerId: "00000000-0000-4000-8000-000000000001",
        displayName: "Customer",
        id: "00000000-0000-4000-8000-000000000021",
        organizationId: null,
        role: "customer" as const,
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
      agreementId: "00000000-0000-4000-8000-000000000002",
      agentId: null,
      calculationId: null,
      createdAt: now,
      id: "00000000-0000-4000-8000-000000000010",
      status: "draft" as const,
      type: "payment" as const,
      updatedAt: now,
    },
    timeline: [],
    transitionReadiness: [
      {
        allowed: false,
        blockers: [
          {
            code: "intake_incomplete",
            message: "Required intake sections are incomplete",
          },
        ],
        targetStatus: "submitted" as const,
      },
    ],
  };
}

function createTestApp() {
  const dealsModule = createDealsModuleStub();
  const dealQuoteWorkflow = {
    createCalculationFromAcceptedQuote: vi.fn(),
  };
  const treasuryModule = {
    quotes: {
      queries: {
        listQuotes: vi.fn(),
        getQuoteDetails: vi.fn(),
      },
    },
  };
  const calculationsModule = {
    calculations: {
      commands: {
        create: vi.fn(),
      },
    },
  };
  const currenciesService = {
    findByCode: vi.fn(),
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: c.req.header("idempotency-key") ?? null,
    });
    await next();
  });

  app.route(
    "/deals",
    dealsRoutes({
      dealQuoteWorkflow,
      dealsModule,
      treasuryModule,
      calculationsModule,
      currenciesService,
    } as any),
  );

  return {
    app,
    dealQuoteWorkflow,
    dealsModule,
    treasuryModule,
    calculationsModule,
    currenciesService,
  };
}

describe("deals routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("lists, fetches, and creates canonical deals", async () => {
    const { app, dealsModule } = createTestApp();
    const detail = createDealDetail();
    dealsModule.deals.queries.list.mockResolvedValue({
      data: [
        {
          id: detail.id,
          customerId: detail.customerId,
          agreementId: detail.agreementId,
          calculationId: detail.calculationId,
          type: detail.type,
          status: detail.status,
          comment: detail.comment,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealsModule.deals.commands.create.mockResolvedValue(detail);

    const listResponse = await app.request("http://localhost/deals");
    const getResponse = await app.request(`http://localhost/deals/${detail.id}`);
    const createResponse = await app.request("http://localhost/deals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "deal-create-1",
      },
      body: JSON.stringify({
        customerId: detail.customerId,
        agreementId: detail.agreementId,
        calculationId: detail.calculationId,
        type: "payment",
        comment: detail.comment,
      }),
    });

    expect(listResponse.status).toBe(200);
    expect(getResponse.status).toBe(200);
    expect(createResponse.status).toBe(201);

    expect(dealsModule.deals.queries.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(dealsModule.deals.queries.findById).toHaveBeenCalledWith(detail.id);
    expect(dealsModule.deals.commands.create).toHaveBeenCalledWith({
      customerId: detail.customerId,
      agreementId: detail.agreementId,
      calculationId: detail.calculationId,
      type: "payment",
      agentId: null,
      comment: detail.comment,
      intakeComment: null,
      reason: null,
      requestedAmount: null,
      actorUserId: "user-1",
      idempotencyKey: "deal-create-1",
    });
  });

  it("returns 404 when a deal is missing", async () => {
    const { app, dealsModule } = createTestApp();
    dealsModule.deals.queries.findById.mockRejectedValue(
      new DealNotFoundError("00000000-0000-4000-8000-000000000099"),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000099",
    );

    expect(response.status).toBe(404);
  });

  it("lists calculation history for a deal", async () => {
    const { app, dealsModule } = createTestApp();
    const detail = createDealDetail();
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealsModule.deals.queries.listCalculationHistory.mockResolvedValue([
      {
        calculationId: detail.calculationId,
        calculationTimestamp: detail.createdAt,
        createdAt: detail.createdAt,
        calculationCurrencyId: "00000000-0000-4000-8000-000000000101",
        baseCurrencyId: "00000000-0000-4000-8000-000000000102",
        originalAmountMinor: "10000",
        feeAmountMinor: "100",
        totalAmountMinor: "10100",
        totalInBaseMinor: "9000",
        totalWithExpensesInBaseMinor: "9100",
        rateNum: "9",
        rateDen: "10",
        fxQuoteId: "00000000-0000-4000-8000-000000000201",
        sourceQuoteId: "00000000-0000-4000-8000-000000000201",
      },
    ]);

    const response = await app.request(
      `http://localhost/deals/${detail.id}/calculations`,
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.queries.listCalculationHistory).toHaveBeenCalledWith(
      detail.id,
    );
  });

  it("does not expose the legacy attach calculation route", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/calculation",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          calculationId: "00000000-0000-4000-8000-000000000011",
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("accepts a quote for a deal", async () => {
    const { app, dealsModule } = createTestApp();
    const projection = { summary: { id: "00000000-0000-4000-8000-000000000010" } };
    dealsModule.deals.commands.acceptQuote.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/quotes/00000000-0000-4000-8000-000000000210/accept",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.acceptQuote).toHaveBeenCalledWith({
      actorUserId: "user-1",
      dealId: "00000000-0000-4000-8000-000000000010",
      quoteId: "00000000-0000-4000-8000-000000000210",
    });
  });

  it("creates a calculation from the accepted quote via the workflow", async () => {
    const { app, dealQuoteWorkflow, dealsModule } = createTestApp();
    const detail = {
      ...createDealDetail(),
      status: "submitted" as const,
      calculationId: null,
    };
    dealsModule.deals.queries.findById.mockResolvedValue(detail);
    dealQuoteWorkflow.createCalculationFromAcceptedQuote.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000501",
      isActive: true,
      currentSnapshot: {
        id: "00000000-0000-4000-8000-000000000502",
        snapshotNumber: 1,
        calculationCurrencyId: "00000000-0000-4000-8000-000000000301",
        originalAmountMinor: "10000",
        feeBps: "10000",
        feeAmountMinor: "100",
        totalAmountMinor: "10100",
        baseCurrencyId: "00000000-0000-4000-8000-000000000302",
        feeAmountInBaseMinor: "90",
        totalInBaseMinor: "9000",
        additionalExpensesCurrencyId: "00000000-0000-4000-8000-000000000302",
        additionalExpensesAmountMinor: "50",
        additionalExpensesInBaseMinor: "50",
        totalWithExpensesInBaseMinor: "9140",
        rateSource: "fx_quote",
        rateNum: "9",
        rateDen: "10",
        additionalExpensesRateSource: null,
        additionalExpensesRateNum: null,
        additionalExpensesRateDen: null,
        calculationTimestamp: new Date("2026-04-01T00:00:00.000Z"),
        fxQuoteId: "00000000-0000-4000-8000-000000000210",
        quoteSnapshot: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      lines: [],
    });

    const response = await app.request(
      `http://localhost/deals/${detail.id}/calculations/from-quote`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "from-quote-1",
        },
        body: JSON.stringify({ quoteId: "00000000-0000-4000-8000-000000000210" }),
      },
    );

    expect(response.status).toBe(201);
    expect(dealQuoteWorkflow.createCalculationFromAcceptedQuote).toHaveBeenCalledWith({
      actorUserId: "user-1",
      dealId: detail.id,
      idempotencyKey: "from-quote-1",
      quoteId: "00000000-0000-4000-8000-000000000210",
    });
  });

  it("returns structured blockers when a status transition is blocked", async () => {
    const { app, dealsModule } = createTestApp();
    dealsModule.deals.commands.transitionStatus.mockRejectedValue(
      new DealTransitionBlockedError("submitted", [
        {
          code: "intake_incomplete",
          message: "Required intake sections are incomplete",
        },
      ] as any),
    );

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/status",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "submitted" }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "deal.transition_blocked",
      details: {
        targetStatus: "submitted",
      },
      error: "Deal transition to submitted is blocked",
    });
  });

  it("updates a deal execution leg state", async () => {
    const { app, dealsModule } = createTestApp();
    const projection = createWorkflowProjection();
    dealsModule.deals.commands.updateLegState.mockResolvedValue(projection);

    const response = await app.request(
      "http://localhost/deals/00000000-0000-4000-8000-000000000010/legs/1/state",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ state: "in_progress" }),
      },
    );

    expect(response.status).toBe(200);
    expect(dealsModule.deals.commands.updateLegState).toHaveBeenCalledWith({
      actorUserId: "user-1",
      comment: null,
      dealId: "00000000-0000-4000-8000-000000000010",
      idx: 1,
      state: "in_progress",
    });
  });
});
