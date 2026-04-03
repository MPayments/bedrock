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

import {
  InvalidPasswordError,
  UserEmailConflictError,
  UserNotFoundError,
} from "@bedrock/iam";

import { profileRoutes } from "../../src/routes/profile";
import { usersRoutes } from "../../src/routes/users";

function createIamServiceStub() {
  return {
    queries: {
      list: vi.fn(),
      findById: vi.fn(),
    },
    commands: {
      create: vi.fn(),
      update: vi.fn(),
      changePassword: vi.fn(),
      changeOwnPassword: vi.fn(),
      ban: vi.fn(),
      unban: vi.fn(),
    },
  };
}

function createUser() {
  const now = new Date("2026-03-01T00:00:00.000Z");

  return {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    emailVerified: true,
    image: null,
    role: "admin" as const,
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: null,
    createdAt: now,
    updatedAt: now,
  };
}

function createUserWithSession() {
  const user = createUser();

  return {
    ...user,
    lastSessionAt: user.createdAt,
    lastSessionIp: "127.0.0.1",
  };
}

function createTestApp() {
  const iamService = createIamServiceStub();
  const app = new OpenAPIHono();

  app.use("*", async (c, next) => {
    c.set("user", { id: "user-1" } as any);
    await next();
  });

  app.route("/users", usersRoutes({ iamService } as any));
  app.route("/profile", profileRoutes({ iamService } as any));

  return { app, iamService };
}

describe("users and profile routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userHasPermission.mockResolvedValue({ success: true });
  });

  it("routes user admin actions through the service and serializes responses", async () => {
    const { app, iamService } = createTestApp();
    const user = createUser();
    const userWithSession = createUserWithSession();
    iamService.queries.list.mockResolvedValue({
      data: [user],
      total: 1,
      limit: 20,
      offset: 0,
    });
    iamService.queries.findById.mockResolvedValue(userWithSession);
    iamService.commands.create.mockResolvedValue(user);
    iamService.commands.update.mockResolvedValue(user);
    iamService.commands.changePassword.mockResolvedValue(undefined);
    iamService.commands.ban.mockResolvedValue(user);
    iamService.commands.unban.mockResolvedValue(user);

    const listResponse = await app.request("http://localhost/users");
    const getResponse = await app.request("http://localhost/users/user-1");
    const createResponse = await app.request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice@example.com",
        password: "secret-123",
        role: "admin",
      }),
    });
    const updateResponse = await app.request("http://localhost/users/user-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Alice 2" }),
    });
    const changePasswordResponse = await app.request(
      "http://localhost/users/user-1/change-password",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: "secret-456" }),
      },
    );
    const banResponse = await app.request("http://localhost/users/user-1/ban", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ banReason: "policy" }),
    });
    const unbanResponse = await app.request(
      "http://localhost/users/user-1/unban",
      { method: "POST" },
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      data: [
        {
          ...user,
          banExpires: null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({
      ...user,
      banExpires: null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastSessionAt: user.createdAt.toISOString(),
      lastSessionIp: "127.0.0.1",
    });

    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(changePasswordResponse.status).toBe(200);
    await expect(changePasswordResponse.json()).resolves.toEqual({
      success: true,
    });
    expect(banResponse.status).toBe(200);
    expect(unbanResponse.status).toBe(200);

    expect(iamService.queries.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    expect(iamService.queries.findById).toHaveBeenCalledWith("user-1");
    expect(iamService.commands.create).toHaveBeenCalledWith({
      name: "Alice",
      email: "alice@example.com",
      password: "secret-123",
      role: "admin",
    });
    expect(iamService.commands.update).toHaveBeenCalledWith("user-1", {
      name: "Alice 2",
    });
    expect(iamService.commands.changePassword).toHaveBeenCalledWith("user-1", {
      newPassword: "secret-456",
    });
    expect(iamService.commands.ban).toHaveBeenCalledWith("user-1", {
      banReason: "policy",
    });
    expect(iamService.commands.unban).toHaveBeenCalledWith("user-1");
  });

  it("maps users route service errors to HTTP responses", async () => {
    const { app, iamService } = createTestApp();
    iamService.queries.findById.mockRejectedValue(
      new UserNotFoundError("missing"),
    );
    iamService.commands.create.mockRejectedValue(
      new UserEmailConflictError("alice@example.com"),
    );
    iamService.commands.update.mockRejectedValue(
      new UserEmailConflictError("alice@example.com"),
    );
    iamService.commands.changePassword.mockRejectedValue(
      new UserNotFoundError("missing"),
    );
    iamService.commands.ban.mockRejectedValue(new UserNotFoundError("missing"));
    iamService.commands.unban.mockRejectedValue(
      new UserNotFoundError("missing"),
    );

    await expect(
      app.request("http://localhost/users/missing").then((response) => ({
        status: response.status,
        body: response.json(),
      })),
    ).resolves.toMatchObject({
      status: 404,
    });

    const createResponse = await app.request("http://localhost/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Alice",
        email: "alice@example.com",
        password: "secret-123",
      }),
    });
    expect(createResponse.status).toBe(409);

    const updateResponse = await app.request("http://localhost/users/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });
    expect(updateResponse.status).toBe(409);

    const changePasswordResponse = await app.request(
      "http://localhost/users/missing/change-password",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: "secret-456" }),
      },
    );
    expect(changePasswordResponse.status).toBe(404);

    expect(
      (
        await app.request("http://localhost/users/missing/ban", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ banReason: "policy" }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request("http://localhost/users/missing/unban", {
          method: "POST",
        })
      ).status,
    ).toBe(404);
  });

  it("routes profile actions through the service and maps profile errors", async () => {
    const { app, iamService } = createTestApp();
    const user = createUser();
    const userWithSession = createUserWithSession();
    iamService.queries.findById.mockResolvedValueOnce(userWithSession);
    iamService.commands.update.mockResolvedValueOnce(user);
    iamService.commands.changeOwnPassword.mockResolvedValueOnce(undefined);

    const getResponse = await app.request("http://localhost/profile");
    const updateResponse = await app.request("http://localhost/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Alice 2" }),
    });
    const changePasswordResponse = await app.request(
      "http://localhost/profile/change-password",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: "old-secret",
          newPassword: "new-secret",
        }),
      },
    );

    expect(getResponse.status).toBe(200);
    expect(updateResponse.status).toBe(200);
    expect(changePasswordResponse.status).toBe(200);
    expect(iamService.queries.findById).toHaveBeenCalledWith("user-1");
    expect(iamService.commands.update).toHaveBeenCalledWith("user-1", {
      name: "Alice 2",
    });
    expect(iamService.commands.changeOwnPassword).toHaveBeenCalledWith("user-1", {
      currentPassword: "old-secret",
      newPassword: "new-secret",
    });

    iamService.queries.findById.mockRejectedValueOnce(
      new UserNotFoundError("user-1"),
    );
    iamService.commands.update.mockRejectedValueOnce(
      new UserEmailConflictError("alice@example.com"),
    );
    iamService.commands.changeOwnPassword.mockRejectedValueOnce(
      new InvalidPasswordError(),
    );
    iamService.commands.changeOwnPassword.mockRejectedValueOnce(
      new UserNotFoundError("user-1"),
    );

    expect((await app.request("http://localhost/profile")).status).toBe(404);
    expect(
      (
        await app.request("http://localhost/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "alice@example.com" }),
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request("http://localhost/profile/change-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            currentPassword: "wrong",
            newPassword: "new-secret",
          }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request("http://localhost/profile/change-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            currentPassword: "old-secret",
            newPassword: "new-secret",
          }),
        })
      ).status,
    ).toBe(404);
  });
});
