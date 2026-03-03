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
    listTrialBalance: vi.fn(),
    listGeneralLedger: vi.fn(),
    listBalanceSheet: vi.fn(),
    listIncomeStatement: vi.fn(),
    listCashFlow: vi.fn(),
    listLiquidity: vi.fn(),
    listFxRevaluation: vi.fn(),
    listFeeRevenueBreakdown: vi.fn(),
    listClosePackage: vi.fn(),
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
