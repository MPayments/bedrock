import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { userHasPermission } = vi.hoisted(() => ({
  userHasPermission: vi.fn(async () => ({ success: true })),
}));

vi.mock("@bedrock/auth", () => ({
  default: {
    api: {
      userHasPermission,
    },
  },
}));

import { docsRoutes } from "../../src/routes/docs";

function createDocumentsServiceStub() {
  return {
    list: vi.fn(),
    createDraft: vi.fn(),
    updateDraft: vi.fn(),
    get: vi.fn(),
    getDetails: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    post: vi.fn(),
    cancel: vi.fn(),
  };
}

function createTestApp() {
  const documentsService = createDocumentsServiceStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    await next();
  });
  app.route("/", docsRoutes({ documentsService } as any));

  return { app, documentsService };
}

describe("docsRoutes validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("returns 400 for invalid list query params", async () => {
    const { app, documentsService } = createTestApp();

    const response = await app.request("http://localhost/?limit=not-a-number");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation error",
    });
    expect(documentsService.list).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid create payloads", async () => {
    const { app, documentsService } = createTestApp();

    const response = await app.request("http://localhost/transfer", {
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
    expect(documentsService.createDraft).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid update payloads", async () => {
    const { app, documentsService } = createTestApp();

    const response = await app.request(
      "http://localhost/transfer/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(null),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation error",
    });
    expect(documentsService.updateDraft).not.toHaveBeenCalled();
  });
});
