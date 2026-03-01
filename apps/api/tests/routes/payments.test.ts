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

import { paymentsRoutes } from "../../src/routes/payments";

function createPaymentsServiceStub() {
  return {
    list: vi.fn(),
    createDraft: vi.fn(),
    get: vi.fn(),
    getDetails: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    post: vi.fn(),
    cancel: vi.fn(),
  };
}

function createTestApp(requestIdempotencyKey: string | null = "idem-1") {
  const paymentsService = createPaymentsServiceStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    c.set("requestContext", {
      requestId: "req-1",
      correlationId: "corr-1",
      traceId: null,
      causationId: null,
      idempotencyKey: requestIdempotencyKey,
    } as any);
    await next();
  });
  app.route("/", paymentsRoutes({ paymentsService } as any));

  return { app, paymentsService };
}

describe("paymentsRoutes validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for invalid list query params", async () => {
    const { app, paymentsService } = createTestApp();

    const response = await app.request("http://localhost/?limit=not-a-number");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation error",
    });
    expect(paymentsService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid create payloads", async () => {
    const { app, paymentsService } = createTestApp();

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        createIdempotencyKey: "",
        input: {},
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation error",
    });
    expect(paymentsService.createDraft).not.toHaveBeenCalled();
  });

  it("returns 400 when non-create mutation misses idempotency header", async () => {
    const { app, paymentsService } = createTestApp(null);

    const response = await app.request(
      "http://localhost/11111111-1111-4111-8111-111111111111/submit",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Idempotency-Key header",
    });
    expect(paymentsService.submit).not.toHaveBeenCalled();
  });
});
