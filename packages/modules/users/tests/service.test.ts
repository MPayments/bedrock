import { describe, expect, it, vi } from "vitest";

import { createUsersService } from "../src";
import { InvalidPasswordError, UserEmailConflictError } from "../src/errors";

function createUsersTestDeps() {
  const authStore = {
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
    authStore,
    passwordHasher,
    service: createUsersService({
      authStore: authStore as any,
      passwordHasher,
    }),
  };
}

describe("users service", () => {
  it("creates users through auth ports and hashes passwords outside the module", async () => {
    const { authStore, passwordHasher, service } = createUsersTestDeps();
    authStore.findUserByEmail.mockResolvedValue(null);
    authStore.createUserWithCredential.mockResolvedValue({
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
    expect(authStore.createUserWithCredential).toHaveBeenCalledWith({
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
    const { authStore, service } = createUsersTestDeps();
    authStore.findUserByEmail.mockResolvedValue({
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

    expect(authStore.createUserWithCredential).not.toHaveBeenCalled();
  });

  it("verifies the current password through the injected hasher", async () => {
    const { authStore, passwordHasher, service } = createUsersTestDeps();
    authStore.getCredentialByUserId.mockResolvedValue({
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

    expect(authStore.updateCredentialPassword).not.toHaveBeenCalled();
  });
});
