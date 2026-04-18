import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import { UserEmailConflictError } from "@bedrock/iam";

import { portalPublicRoutes } from "../../src/routes/portal-public";

function createIamServiceStub() {
  return {
    commands: {
      create: vi.fn(),
    },
  };
}

function createPortalAccessGrantsServiceStub() {
  return {
    commands: {
      create: vi.fn(),
    },
  };
}

function createTestApp() {
  const iamService = createIamServiceStub();
  const portalAccessGrantsService = createPortalAccessGrantsServiceStub();
  const app = new OpenAPIHono();

  app.route(
    "/api/portal",
    portalPublicRoutes({ iamService, portalAccessGrantsService } as any),
  );

  return { app, iamService, portalAccessGrantsService };
}

describe("portal public routes", () => {
  it("creates portal users with a pending onboarding grant", async () => {
    const { app, iamService, portalAccessGrantsService } = createTestApp();

    iamService.commands.create.mockResolvedValue({
      id: "user-1",
    });

    const response = await app.request(
      "http://localhost/api/portal/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Portal User",
          email: "portal@example.com",
          password: "secret-123",
        }),
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(iamService.commands.create).toHaveBeenCalledWith({
      name: "Portal User",
      email: "portal@example.com",
      password: "secret-123",
      role: null,
    });
    expect(portalAccessGrantsService.commands.create).toHaveBeenCalledWith({
      userId: "user-1",
    });
  });

  it("maps email conflicts to 409", async () => {
    const { app, iamService } = createTestApp();

    iamService.commands.create.mockRejectedValue(
      new UserEmailConflictError("portal@example.com"),
    );

    const response = await app.request(
      "http://localhost/api/portal/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Portal User",
          email: "portal@example.com",
          password: "secret-123",
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "User with email already exists: portal@example.com",
    });
  });

  it("does not mount the legacy customer registration path", async () => {
    const { app } = createTestApp();

    const response = await app.request(
      "http://localhost/api/customer-auth/register",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(404);
  });
});
