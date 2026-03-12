import { afterEach, describe, expect, it, vi } from "vitest";

import { createDrizzleAuthIdentityStore } from "../src/identity-store";
import { account, session, user } from "../src/schema";

describe("createDrizzleAuthIdentityStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a user and credential account in one transaction", async () => {
    const createdUser = {
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
    };

    const insertUserValues = vi.fn(() => ({
      returning: vi.fn(async () => [createdUser]),
    }));
    const insertAccountValues = vi.fn(async () => undefined);
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce({ values: insertUserValues })
        .mockReturnValueOnce({ values: insertAccountValues }),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("user-1")
      .mockReturnValueOnce("account-1");

    const store = createDrizzleAuthIdentityStore({ db: db as any });

    const result = await store.createUserWithCredential({
      name: "Alice",
      email: "alice@example.com",
      passwordHash: "hashed-password",
      role: "admin",
      emailVerified: true,
      now: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(result).toEqual(createdUser);
    expect(tx.insert).toHaveBeenNthCalledWith(1, user);
    expect(insertUserValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        email: "alice@example.com",
        role: "admin",
      }),
    );
    expect(tx.insert).toHaveBeenNthCalledWith(2, account);
    expect(insertAccountValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "account-1",
        userId: "user-1",
        password: "hashed-password",
      }),
    );
  });

  it("loads a user together with their latest session", async () => {
    const userRow = {
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
    };
    const lastSession = {
      createdAt: new Date("2026-03-02T10:00:00.000Z"),
      ipAddress: "127.0.0.1",
    };
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [userRow]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => [lastSession]),
              })),
            })),
          })),
        }),
    };

    const store = createDrizzleAuthIdentityStore({ db: db as any });

    await expect(store.getUserWithLastSession("user-1")).resolves.toEqual({
      user: userRow,
      lastSessionAt: lastSession.createdAt,
      lastSessionIp: lastSession.ipAddress,
    });
  });

  it("bans a user and deletes their sessions in one transaction", async () => {
    const updatedUser = {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      emailVerified: true,
      image: null,
      role: "admin",
      banned: true,
      banReason: "fraud-review",
      banExpires: null,
      twoFactorEnabled: null,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    };

    const updateWhere = vi.fn(() => ({
      returning: vi.fn(async () => [updatedUser]),
    }));
    const updateSet = vi.fn(() => ({
      where: updateWhere,
    }));
    const deleteWhere = vi.fn(async () => undefined);
    const tx = {
      update: vi.fn(() => ({
        set: updateSet,
      })),
      delete: vi.fn(() => ({
        where: deleteWhere,
      })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };

    const store = createDrizzleAuthIdentityStore({ db: db as any });

    await expect(
      store.banUser({
        id: "user-1",
        banReason: "fraud-review",
      }),
    ).resolves.toEqual(updatedUser);

    expect(tx.update).toHaveBeenCalledWith(user);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        banned: true,
        banReason: "fraud-review",
      }),
    );
    expect(tx.delete).toHaveBeenCalledWith(session);
    expect(deleteWhere).toHaveBeenCalled();
  });
});
