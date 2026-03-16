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

import { organizationsRoutes } from "../../src/routes/organizations";
import { requisiteProvidersRoutes } from "../../src/routes/requisite-providers";

function createOrganizationsServiceStub() {
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

function createRequisitesServiceStub() {
  return {
    providers: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            kind: "bank",
            name: "Core Bank",
          },
        ],
        total: 1,
        limit: 1,
        offset: 0,
      }),
    },
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
    const organizationsService = createOrganizationsServiceStub();
    const app = createTestApp(() =>
      organizationsRoutes({ organizationsService } as any),
    );

    const response = await app.request("http://localhost/options");

    expect(response.status).toBe(200);
    expect(organizationsService.list).toHaveBeenCalledWith({
      limit: 200,
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

  it("bounds requisite provider options requests to the validated page size", async () => {
    const requisitesService = createRequisitesServiceStub();
    const app = createTestApp(() =>
      requisiteProvidersRoutes({ requisitesService } as any),
    );

    const response = await app.request("http://localhost/options");

    expect(response.status).toBe(200);
    expect(requisitesService.providers.list).toHaveBeenCalledWith({
      limit: 200,
      offset: 0,
      sortBy: "name",
      sortOrder: "asc",
    });
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          kind: "bank",
          name: "Core Bank",
          label: "Core Bank",
        },
      ],
    });
  });
});
