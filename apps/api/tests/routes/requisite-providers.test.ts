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

import { requisiteProvidersRoutes } from "../../src/routes/requisite-providers";

function createProvider() {
  const now = new Date("2026-04-01T00:00:00.000Z");

  return {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "bank" as const,
    legalName: "Core Bank LLC",
    displayName: "Core Bank",
    description: null,
    country: "US",
    website: null,
    identifiers: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        providerId: "11111111-1111-4111-8111-111111111111",
        scheme: "swift",
        value: "COREUS33",
        normalizedValue: "COREUS33",
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    branches: [],
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp() {
  const requisites = {
    commands: {
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      removeProvider: vi.fn(),
    },
    queries: {
      listProviders: vi.fn().mockResolvedValue({
        data: [],
        limit: 20,
        offset: 0,
        total: 0,
      }),
      findProviderById: vi.fn(),
    },
  };
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1", role: "admin" } as any);
    await next();
  });

  app.route(
    "/requisites/providers",
    requisiteProvidersRoutes({
      partiesModule: {
        requisites,
      },
    } as any),
  );

  return { app, requisites };
}

describe("requisite provider routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("updates provider master data through the top-level patch route", async () => {
    const { app, requisites } = createTestApp();
    requisites.commands.updateProvider.mockResolvedValue(createProvider());

    const response = await app.request(
      "http://localhost/requisites/providers/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Core Bank",
          identifiers: [{ scheme: "swift", value: "coreus33", isPrimary: true }],
          branches: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(requisites.commands.updateProvider).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      {
        displayName: "Core Bank",
        identifiers: [{ scheme: "swift", value: "coreus33", isPrimary: true }],
        branches: [],
      },
    );
  });

  it("does not expose the legacy provider identifier route", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/requisites/providers/11111111-1111-4111-8111-111111111111/identifiers",
    );

    expect(response.status).toBe(404);
  });
});
