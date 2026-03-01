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

import { orchestrationRoutes } from "../../src/routes/orchestration";

function createOrchestrationServiceStub() {
  return {
    listRoutingRules: vi.fn(),
    createRoutingRule: vi.fn(),
    updateRoutingRule: vi.fn(),
    deleteRoutingRule: vi.fn(),
    listProviderCorridors: vi.fn(),
    createProviderCorridor: vi.fn(),
    updateProviderCorridor: vi.fn(),
    deleteProviderCorridor: vi.fn(),
    listProviderFeeSchedules: vi.fn(),
    createProviderFeeSchedule: vi.fn(),
    updateProviderFeeSchedule: vi.fn(),
    deleteProviderFeeSchedule: vi.fn(),
    listProviderLimits: vi.fn(),
    createProviderLimit: vi.fn(),
    updateProviderLimit: vi.fn(),
    deleteProviderLimit: vi.fn(),
    listScopeOverrides: vi.fn(),
    createScopeOverride: vi.fn(),
    updateScopeOverride: vi.fn(),
    deleteScopeOverride: vi.fn(),
    simulateRoute: vi.fn(),
  };
}

function createTestApp() {
  const orchestrationService = createOrchestrationServiceStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: "idem-1",
    } as any);
    await next();
  });
  app.route("/", orchestrationRoutes({ orchestrationService } as any));

  return { app, orchestrationService };
}

describe("orchestrationRoutes validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for invalid uuid in resource id param", async () => {
    const { app, orchestrationService } = createTestApp();

    const response = await app.request("http://localhost/not-a-uuid", {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation error",
    });
    expect(orchestrationService.deleteRoutingRule).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid route simulation payload", async () => {
    const { app, orchestrationService } = createTestApp();

    const response = await app.request("http://localhost/simulate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation error",
    });
    expect(orchestrationService.simulateRoute).not.toHaveBeenCalled();
  });
});
