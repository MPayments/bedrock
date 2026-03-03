import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ValidationError } from "@bedrock/kernel/errors";

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

import { accountingRoutes } from "../../src/routes/accounting";

function createAccountingServiceStub() {
  return {
    listTemplateAccounts: vi.fn(),
    listCorrespondenceRules: vi.fn(),
    replaceCorrespondenceRules: vi.fn(),
    validatePostingMatrix: vi.fn(),
  };
}

function createAccountingReportingServiceStub() {
  return {
    listOperationsWithLabels: vi.fn(),
    getOperationDetailsWithLabels: vi.fn(),
    listFinancialResultsByCounterparty: vi.fn(),
    listFinancialResultsByGroup: vi.fn(),
  };
}

function createBalancesServiceStub() {
  return {
    listBalancesByCounterpartyAccountIds: vi.fn(),
  };
}

function createTestApp() {
  const accountingService = createAccountingServiceStub();
  const accountingReportingService = createAccountingReportingServiceStub();
  const balancesService = createBalancesServiceStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    await next();
  });

  app.route(
    "/",
    accountingRoutes({
      accountingService,
      accountingReportingService,
      balancesService,
    } as any),
  );

  return { app, accountingReportingService, balancesService };
}

describe("accountingRoutes error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for validation errors in counterparty financial results", async () => {
    const { app, accountingReportingService } = createTestApp();
    accountingReportingService.listFinancialResultsByCounterparty.mockRejectedValue(
      new ValidationError("from must be earlier than or equal to to"),
    );

    const response = await app.request(
      "http://localhost/financial-results/counterparties?from=2026-01-02T00:00:00.000Z&to=2026-01-01T00:00:00.000Z",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "from must be earlier than or equal to to",
    });
  });

  it("maps financial result minor values to amount values", async () => {
    const { app, accountingReportingService } = createTestApp();
    accountingReportingService.listFinancialResultsByCounterparty.mockResolvedValue({
      data: [
        {
          entityType: "counterparty",
          counterpartyId: "11111111-1111-4111-8111-111111111111",
          counterpartyName: "Acme",
          currency: "USD",
          revenueMinor: 1050n,
          expenseMinor: 250n,
          netMinor: 800n,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
      summaryByCurrency: [
        {
          currency: "USD",
          revenueMinor: 1050n,
          expenseMinor: 250n,
          netMinor: 800n,
        },
      ],
    });

    const response = await app.request(
      "http://localhost/financial-results/counterparties",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          entityType: "counterparty",
          counterpartyId: "11111111-1111-4111-8111-111111111111",
          counterpartyName: "Acme",
          currency: "USD",
          revenue: "10.5",
          expense: "2.5",
          net: "8",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
      summaryByCurrency: [
        {
          currency: "USD",
          revenue: "10.5",
          expense: "2.5",
          net: "8",
        },
      ],
    });
  });

  it("maps operation posting amount from amountMinor to amount", async () => {
    const { app, accountingReportingService } = createTestApp();
    const operationId = "22222222-2222-4222-8222-222222222222";
    accountingReportingService.getOperationDetailsWithLabels.mockResolvedValue({
      operation: {
        id: operationId,
        sourceType: "document",
        sourceId: "source-1",
        operationCode: "op_code",
        operationVersion: 1,
        postingDate: new Date("2026-01-01T00:00:00.000Z"),
        status: "posted",
        error: null,
        postedAt: null,
        outboxAttempts: 0,
        lastOutboxErrorAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        postingCount: 1,
        bookIds: ["33333333-3333-4333-8333-333333333333"],
        bookLabels: {},
        currencies: ["USD"],
      },
      postings: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          lineNo: 1,
          bookId: "33333333-3333-4333-8333-333333333333",
          bookName: "Main book",
          debitInstanceId: "55555555-5555-4555-8555-555555555555",
          debitAccountNo: "1010",
          debitDimensions: null,
          creditInstanceId: "66666666-6666-4666-8666-666666666666",
          creditAccountNo: "2010",
          creditDimensions: null,
          postingCode: "posting_code",
          currency: "USD",
          currencyPrecision: 2,
          amountMinor: 1205n,
          memo: null,
          context: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      tbPlans: [],
      dimensionLabels: {},
    });

    const response = await app.request(
      `http://localhost/operations/${operationId}`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.postings[0]).toMatchObject({
      amount: "12.05",
      currency: "USD",
      currencyPrecision: 2,
    });
    expect(payload.postings[0]?.amountMinor).toBeUndefined();
  });

  it("maps counterparty account balance to amount field", async () => {
    const { app, balancesService } = createTestApp();
    balancesService.listBalancesByCounterpartyAccountIds.mockResolvedValue([
      {
        counterpartyAccountId: "77777777-7777-4777-8777-777777777777",
        currency: "JPY",
        balanceMinor: 150n,
        precision: 0,
      },
    ]);

    const response = await app.request(
      "http://localhost/counterparty-account-balances?counterpartyAccountIds=77777777-7777-4777-8777-777777777777",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        counterpartyAccountId: "77777777-7777-4777-8777-777777777777",
        currency: "JPY",
        balance: "150",
        precision: 0,
      },
    ]);
  });
});
