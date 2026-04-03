import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";

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

import { agentsRoutes } from "../../src/routes/agents";

function createIamServiceStub() {
  return {
    queries: {
      list: vi.fn(),
    },
  };
}

function createTestApp() {
  const iamService = createIamServiceStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    await next();
  });
  app.route("/agents", agentsRoutes({ iamService } as any));

  return { app, iamService };
}

describe("agents routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("pages through IAM users with the validated page size", async () => {
    const { app, iamService } = createTestApp();

    iamService.queries.list
      .mockResolvedValueOnce({
        data: [
          {
            id: "user-1",
            name: "Alice",
            email: "alice@example.com",
            role: "admin",
          },
        ],
        total: MAX_QUERY_LIST_LIMIT + 1,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "user-2",
            name: "Bob",
            email: "bob@example.com",
            role: "agent",
          },
        ],
        total: MAX_QUERY_LIST_LIMIT + 1,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: MAX_QUERY_LIST_LIMIT,
      });

    const response = await app.request("http://localhost/agents");

    expect(response.status).toBe(200);
    expect(iamService.queries.list).toHaveBeenNthCalledWith(1, {
      banned: false,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      role: ["admin", "agent", "user"],
      sortBy: "name",
      sortOrder: "asc",
    });
    expect(iamService.queries.list).toHaveBeenNthCalledWith(2, {
      banned: false,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: MAX_QUERY_LIST_LIMIT,
      role: ["admin", "agent", "user"],
      sortBy: "name",
      sortOrder: "asc",
    });
    await expect(response.json()).resolves.toEqual([
      {
        email: "alice@example.com",
        id: "user-1",
        isAdmin: true,
        name: "Alice",
      },
      {
        email: "bob@example.com",
        id: "user-2",
        isAdmin: false,
        name: "Bob",
      },
    ]);
  });
});
