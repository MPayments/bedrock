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

import { connectorsRoutes } from "../../src/routes/connectors";

function createConnectorsServiceStub() {
  return {
    listProviderHealth: vi.fn(),
    upsertProviderHealth: vi.fn(),
    listAttempts: vi.fn(),
    listEvents: vi.fn(),
    ingestStatementBatch: vi.fn(),
    handleWebhookEvent: vi.fn(),
    getAttemptById: vi.fn(),
    getIntentById: vi.fn(),
    providers: {} as Record<string, unknown>,
  };
}

function createPaymentsServiceStub() {
  return {
    createResolution: vi.fn(),
  };
}

function createTestApp() {
  const connectorsService = createConnectorsServiceStub();
  const paymentsService = createPaymentsServiceStub();
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
  app.route("/", connectorsRoutes({ connectorsService, paymentsService } as any));

  return { app, connectorsService, paymentsService };
}

describe("connectorsRoutes validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for invalid attempts query params", async () => {
    const { app, connectorsService } = createTestApp();

    const response = await app.request("http://localhost/attempts?limit=not-a-number");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation error",
    });
    expect(connectorsService.listAttempts).not.toHaveBeenCalled();
  });

  it("returns 404 for webhook provider that is not configured", async () => {
    const { app, connectorsService } = createTestApp();

    const response = await app.request("http://localhost/providers/mock/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        eventId: "evt-1",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Connector provider not configured"),
    });
    expect(connectorsService.handleWebhookEvent).not.toHaveBeenCalled();
  });
});
