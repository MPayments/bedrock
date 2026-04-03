import { describe, expect, it, vi } from "vitest";

import { createIamService } from "../src";
import { UserAccount } from "../src/domain/user-account";
import {
  InvalidPasswordError,
  UserEmailConflictError,
  UserNotFoundError,
} from "../src/errors";

function createUserAccount(overrides: Partial<ReturnType<UserAccount["toSnapshot"]>> = {}) {
  return UserAccount.fromSnapshot({
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    emailVerified: true,
    image: null,
    role: "admin",
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: false,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  });
}

function createUsersTestDeps() {
  const reads = {
    listUsers: vi.fn(),
    getUserWithLastSession: vi.fn(),
  };
  const commandTx = {
    users: {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      save: vi.fn(),
    },
    credentials: {
      findByUserId: vi.fn(),
      create: vi.fn(),
      updatePassword: vi.fn(),
    },
    sessions: {
      deleteForUser: vi.fn(),
    },
    agentProfiles: {
      ensureProvisioned: vi.fn(),
    },
  };
  const commandUow = {
    run: vi.fn(async (work: (tx: typeof commandTx) => Promise<unknown>) =>
      work(commandTx),
    ),
  };
  const passwordHasher = {
    hash: vi.fn(async (password: string) => `hashed:${password}`),
    verify: vi.fn(async () => true),
  };
  const now = new Date("2026-03-01T00:00:00.000Z");
  const generateUuid = vi
    .fn()
    .mockReturnValueOnce("user-1")
    .mockReturnValueOnce("account-1");

  return {
    reads,
    commandTx,
    commandUow,
    passwordHasher,
    service: createIamService({
      reads: reads as any,
      commandUow: commandUow as any,
      passwordHasher,
      now: () => now,
      generateUuid,
    }),
  };
}

describe("iam service", () => {
  it("creates users through auth ports and hashes passwords outside the module", async () => {
    const { commandTx, passwordHasher, service } = createUsersTestDeps();
    commandTx.users.findByEmail.mockResolvedValue(null);
    commandTx.users.save.mockImplementation(async (userAccount) => userAccount);
    commandTx.credentials.create.mockResolvedValue({
      id: "account-1",
      userId: "user-1",
      providerId: "credential",
      password: "hashed:secret-123",
    });

    const result = await service.commands.create({
      name: "Alice",
      email: "alice@example.com",
      password: "secret-123",
      role: "admin",
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith("secret-123");
    expect(commandTx.users.save).toHaveBeenCalledTimes(1);
    expect(commandTx.users.save.mock.calls[0]![0].toSnapshot()).toMatchObject({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
      banned: false,
    });
    expect(commandTx.credentials.create).toHaveBeenCalledWith({
      id: "account-1",
      userId: "user-1",
      passwordHash: "hashed:secret-123",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(commandTx.agentProfiles.ensureProvisioned).toHaveBeenCalledWith({
      userId: "user-1",
      now: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(result.email).toBe("alice@example.com");
    expect(result.role).toBe("admin");
  });

  it("computes agent-profile provisioning in application code before updating users", async () => {
    const { commandTx, service } = createUsersTestDeps();
    commandTx.users.findById.mockResolvedValue(createUserAccount());
    commandTx.users.findByEmail.mockResolvedValue(null);
    commandTx.users.save.mockImplementation(async (userAccount) => userAccount);

    await service.commands.update("user-1", { role: "customer" });

    expect(commandTx.users.save).toHaveBeenCalledTimes(1);
    expect(commandTx.users.save.mock.calls[0]![0].toSnapshot()).toMatchObject({
      id: "user-1",
      role: "customer",
    });
    expect(commandTx.agentProfiles.ensureProvisioned).not.toHaveBeenCalled();
  });

  it("rejects duplicate emails before delegating user creation", async () => {
    const { commandTx, service } = createUsersTestDeps();
    commandTx.users.findByEmail.mockResolvedValue(createUserAccount());

    await expect(
      service.commands.create({
        name: "Alice",
        email: "alice@example.com",
        password: "secret-123",
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(UserEmailConflictError);

    expect(commandTx.users.save).not.toHaveBeenCalled();
  });

  it("verifies the current password through the injected hasher", async () => {
    const { commandTx, passwordHasher, service } = createUsersTestDeps();
    commandTx.credentials.findByUserId.mockResolvedValue({
      id: "acc-1",
      userId: "user-1",
      providerId: "credential",
      password: "stored-hash",
    });
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      service.commands.changeOwnPassword("user-1", {
        currentPassword: "wrong",
        newPassword: "new-secret",
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);

    expect(commandTx.credentials.updatePassword).not.toHaveBeenCalled();
  });

  it("propagates not found for ban and unban operations", async () => {
    const { commandTx, service } = createUsersTestDeps();
    commandTx.users.findById.mockResolvedValue(null);

    await expect(
      service.commands.ban("missing", { banReason: "policy" }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    await expect(service.commands.unban("missing")).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it("maps findById results with last session metadata", async () => {
    const { reads, service } = createUsersTestDeps();
    const now = new Date("2026-03-01T00:00:00.000Z");
    reads.getUserWithLastSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        emailVerified: true,
        image: null,
        role: "admin",
        banned: null,
        banReason: null,
        banExpires: null,
        twoFactorEnabled: null,
        createdAt: now,
        updatedAt: now,
      },
      lastSessionAt: now,
      lastSessionIp: "127.0.0.1",
    });

    await expect(service.queries.findById("user-1")).resolves.toEqual({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: true,
      image: null,
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: null,
      createdAt: now,
      updatedAt: now,
      lastSessionAt: now,
      lastSessionIp: "127.0.0.1",
    });
  });
});
