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

  return { app, accountingReportingService };
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
});
