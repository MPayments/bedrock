import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import { UserEmailConflictError } from "@bedrock/iam";

import { customerAuthRoutes } from "../../src/routes/customer-auth";

function createIamServiceStub() {
  return {
    commands: {
      create: vi.fn(),
    },
  };
}

function createTestApp() {
  const iamService = createIamServiceStub();
  const app = new OpenAPIHono();

  app.route("/api/customer-auth", customerAuthRoutes({ iamService } as any));

  return { app, iamService };
}

describe("customer auth routes", () => {
  it("creates customer users with the customer role", async () => {
    const { app, iamService } = createTestApp();

    iamService.commands.create.mockResolvedValue({
      id: "user-1",
    });

    const response = await app.request(
      "http://localhost/api/customer-auth/register",
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
      role: "customer",
    });
  });

  it("maps email conflicts to 409", async () => {
    const { app, iamService } = createTestApp();

    iamService.commands.create.mockRejectedValue(
      new UserEmailConflictError("portal@example.com"),
    );

    const response = await app.request(
      "http://localhost/api/customer-auth/register",
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
});
