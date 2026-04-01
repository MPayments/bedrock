import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/auth", () => ({
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { DealNotFoundError } from "@bedrock/deals";

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
        list: vi.fn(),
        findById: vi.fn(),
        listCalculationHistory: vi.fn(),
      },
      commands: {
        create: vi.fn(),
        attachCalculation: vi.fn(),
      },
    },
  };
}

function createTestApp() {
  const dealsModule = createDealsModuleStub();
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
      dealsModule,
      treasuryModule,
      calculationsModule,
      currenciesService,
    } as any),
  );

  return {
    app,
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

  it("requires idempotency for attach calculation", async () => {
    const { app, dealsModule } = createTestApp();

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

    expect(response.status).toBe(400);
    expect(dealsModule.deals.commands.attachCalculation).not.toHaveBeenCalled();
  });

  it("creates a calculation from a quote and attaches it", async () => {
    const {
      app,
      dealsModule,
      treasuryModule,
      calculationsModule,
      currenciesService,
    } = createTestApp();
    const detail = {
      ...createDealDetail(),
      status: "submitted" as const,
      calculationId: null,
    };
    dealsModule.deals.queries.findById.mockResolvedValue(detail);

    treasuryModule.quotes.queries.getQuoteDetails.mockResolvedValue({
      quote: {
        id: "00000000-0000-4000-8000-000000000210",
        fromCurrencyId: "00000000-0000-4000-8000-000000000301",
        toCurrencyId: "00000000-0000-4000-8000-000000000302",
        fromCurrency: "USD",
        toCurrency: "EUR",
        fromAmountMinor: 10000n,
        toAmountMinor: 9000n,
        pricingMode: "auto_cross",
        pricingTrace: {},
        dealDirection: null,
        dealForm: null,
        rateNum: 9n,
        rateDen: 10n,
        status: "active",
        dealId: detail.id,
        usedByRef: null,
        usedDocumentId: null,
        usedAt: null,
        expiresAt: new Date("2026-04-01T00:00:00.000Z"),
        idempotencyKey: "quote-1",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      legs: [],
      feeComponents: [],
      financialLines: [
        {
          id: "line-1",
          bucket: "fee_revenue",
          currency: "USD",
          amountMinor: 100n,
          source: "rule",
        },
        {
          id: "line-2",
          bucket: "pass_through",
          currency: "EUR",
          amountMinor: 50n,
          source: "rule",
        },
      ],
      pricingTrace: {},
    });

    currenciesService.findByCode.mockImplementation(async (code: string) => ({
      id:
        code === "USD"
          ? "00000000-0000-4000-8000-000000000401"
          : "00000000-0000-4000-8000-000000000402",
      code,
      precision: 2,
    }));

    calculationsModule.calculations.commands.create.mockResolvedValue({
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

    dealsModule.deals.commands.attachCalculation.mockResolvedValue(detail);

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
    expect(calculationsModule.calculations.commands.create).toHaveBeenCalledWith(
      expect.objectContaining({
        calculationCurrencyId: "00000000-0000-4000-8000-000000000301",
        originalAmountMinor: "10000",
        feeAmountMinor: "100",
        totalAmountMinor: "10100",
        baseCurrencyId: "00000000-0000-4000-8000-000000000302",
        feeAmountInBaseMinor: "90",
        totalInBaseMinor: "9000",
        additionalExpensesAmountMinor: "50",
        totalWithExpensesInBaseMinor: "9140",
        rateSource: "fx_quote",
        rateNum: "9",
        rateDen: "10",
        fxQuoteId: "00000000-0000-4000-8000-000000000210",
      }),
    );
    expect(dealsModule.deals.commands.attachCalculation).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: detail.id,
        calculationId: "00000000-0000-4000-8000-000000000501",
        sourceQuoteId: "00000000-0000-4000-8000-000000000210",
      }),
    );
  });
});
