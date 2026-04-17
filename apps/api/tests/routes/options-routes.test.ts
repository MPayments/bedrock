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

import { organizationsRoutes } from "../../src/routes/organizations";
import { customersRoutes } from "../../src/routes/customers";
import { requisiteProvidersRoutes } from "../../src/routes/requisite-providers";

function createOrganizationsQueryStub() {
  return {
    list: vi.fn().mockResolvedValue({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          shortName: "Bedrock Treasury",
        },
      ],
      total: 1,
      limit: 1,
      offset: 0,
    }),
  };
}

function createCustomersQueryStub() {
  return {
    list: vi.fn().mockResolvedValue({
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Acme Trading",
        },
      ],
      total: 1,
      limit: 1,
      offset: 0,
    }),
  };
}

function createRequisiteProvidersQueryStub() {
  return {
    listProviders: vi.fn().mockResolvedValue({
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          kind: "bank",
          displayName: "Core Bank",
          legalName: "Core Bank",
        },
      ],
      total: 1,
      limit: 1,
      offset: 0,
    }),
  };
}

function createTestApp(routeFactory: () => OpenAPIHono) {
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    await next();
  });
  app.route("/", routeFactory());

  return app;
}

describe("options routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("bounds organization options requests to the validated page size", async () => {
    const organizationsQueries = createOrganizationsQueryStub();
    const app = createTestApp(() =>
      organizationsRoutes({
        partiesModule: {
          organizations: {
            queries: organizationsQueries,
          },
        },
      } as any),
    );

    const response = await app.request("http://localhost/options");

    expect(response.status).toBe(200);
    expect(organizationsQueries.list).toHaveBeenCalledWith({
      isActive: true,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "shortName",
      sortOrder: "asc",
    });
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          shortName: "Bedrock Treasury",
          label: "Bedrock Treasury",
        },
      ],
    });
  });

  it("bounds customer options requests to the validated page size", async () => {
    const customersQueries = createCustomersQueryStub();
    const app = createTestApp(() =>
      customersRoutes({
        partiesModule: {
          customers: {
            queries: customersQueries,
          },
        },
      } as any),
    );

    const response = await app.request("http://localhost/options");

    expect(response.status).toBe(200);
    expect(customersQueries.list).toHaveBeenCalledWith({
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "Acme Trading",
          label: "Acme Trading",
        },
      ],
    });
  });

  it("bounds requisite provider options requests to the validated page size", async () => {
    const requisitesQueries = createRequisiteProvidersQueryStub();
    const app = createTestApp(() =>
      requisiteProvidersRoutes({
        partiesModule: {
          requisites: {
            queries: requisitesQueries,
          },
        },
      } as any),
    );

    const response = await app.request("http://localhost/options");

    expect(response.status).toBe(200);
    expect(requisitesQueries.listProviders).toHaveBeenCalledWith({
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "displayName",
      sortOrder: "asc",
    });
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          kind: "bank",
          displayName: "Core Bank",
          label: "Core Bank",
        },
      ],
    });
  });
});
