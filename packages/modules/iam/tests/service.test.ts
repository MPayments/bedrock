import { describe, expect, it, vi } from "vitest";

import { createIamService } from "../src";
import {
  InvalidPasswordError,
  UserEmailConflictError,
  UserNotFoundError,
} from "../src/errors";

function createUsersTestDeps() {
  const identityStore = {
    listUsers: vi.fn(),
    findUserById: vi.fn(),
    findUserByEmail: vi.fn(),
    createUserWithCredential: vi.fn(),
    updateUser: vi.fn(),
    getCredentialByUserId: vi.fn(),
    updateCredentialPassword: vi.fn(),
    deleteSessionsForUser: vi.fn(),
    getUserWithLastSession: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
  };
  const passwordHasher = {
    hash: vi.fn(async (password: string) => `hashed:${password}`),
    verify: vi.fn(async () => true),
  };

  return {
    identityStore,
    passwordHasher,
    service: createIamService({
      identityStore: identityStore as any,
      passwordHasher,
    }),
  };
}

describe("iam service", () => {
  it("creates users through auth ports and hashes passwords outside the module", async () => {
    const { identityStore, passwordHasher, service } = createUsersTestDeps();
    identityStore.findUserByEmail.mockResolvedValue(null);
    identityStore.createUserWithCredential.mockResolvedValue({
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
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const result = await service.create({
      name: "Alice",
      email: "alice@example.com",
      password: "secret-123",
      role: "admin",
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith("secret-123");
    expect(identityStore.createUserWithCredential).toHaveBeenCalledWith({
      name: "Alice",
      email: "alice@example.com",
      role: "admin",
      passwordHash: "hashed:secret-123",
      emailVerified: true,
    });
    expect(result.email).toBe("alice@example.com");
    expect(result.role).toBe("admin");
  });

  it("rejects duplicate emails before delegating user creation", async () => {
    const { identityStore, service } = createUsersTestDeps();
    identityStore.findUserByEmail.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
    });

    await expect(
      service.create({
        name: "Alice",
        email: "alice@example.com",
        password: "secret-123",
        role: "admin",
      }),
    ).rejects.toBeInstanceOf(UserEmailConflictError);

    expect(identityStore.createUserWithCredential).not.toHaveBeenCalled();
  });

  it("verifies the current password through the injected hasher", async () => {
    const { identityStore, passwordHasher, service } = createUsersTestDeps();
    identityStore.getCredentialByUserId.mockResolvedValue({
      id: "acc-1",
      userId: "user-1",
      providerId: "credential",
      password: "stored-hash",
    });
    passwordHasher.verify.mockResolvedValue(false);

    await expect(
      service.changeOwnPassword("user-1", {
        currentPassword: "wrong",
        newPassword: "new-secret",
      }),
    ).rejects.toBeInstanceOf(InvalidPasswordError);

    expect(identityStore.updateCredentialPassword).not.toHaveBeenCalled();
  });

  it("propagates not found for ban and unban operations", async () => {
    const { identityStore, service } = createUsersTestDeps();
    identityStore.banUser.mockResolvedValue(null);
    identityStore.unbanUser.mockResolvedValue(null);

    await expect(
      service.ban("missing", { banReason: "policy" }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    await expect(service.unban("missing")).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it("maps findById results with last session metadata", async () => {
    const { identityStore, service } = createUsersTestDeps();
    const now = new Date("2026-03-01T00:00:00.000Z");
    identityStore.getUserWithLastSession.mockResolvedValue({
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

    await expect(service.findById("user-1")).resolves.toEqual({
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
