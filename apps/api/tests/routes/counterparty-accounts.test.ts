import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AccountBindingNotFoundError,
  AccountNotFoundError,
} from "@bedrock/core/counterparty-accounts";

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

import { counterpartyAccountsRoutes } from "../../src/routes/counterparty-accounts";

function createCounterpartyAccountsServiceStub() {
  return {
    listAccounts: vi.fn(),
    createAccount: vi.fn(),
    getAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
  };
}

function createTestApp() {
  const counterpartyAccountsService = createCounterpartyAccountsServiceStub();
  const app = new OpenAPIHono();

  app.onError(() => {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  });

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    await next();
  });

  app.route(
    "/",
    counterpartyAccountsRoutes({ counterpartyAccountsService } as any),
  );

  return { app, counterpartyAccountsService };
}

describe("counterpartyAccountsRoutes error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 500 when counterparty account binding is missing", async () => {
    const { app, counterpartyAccountsService } = createTestApp();
    const id = "00000000-0000-4000-8000-000000000401";
    counterpartyAccountsService.getAccount.mockRejectedValue(
      new AccountBindingNotFoundError(id),
    );

    const response = await app.request(`http://localhost/${id}`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });

  it("returns 404 when counterparty account is missing", async () => {
    const { app, counterpartyAccountsService } = createTestApp();
    const id = "00000000-0000-4000-8000-000000000401";
    counterpartyAccountsService.getAccount.mockRejectedValue(
      new AccountNotFoundError(id),
    );

    const response = await app.request(`http://localhost/${id}`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: `Account not found: ${id}`,
    });
  });
});
