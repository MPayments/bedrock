import { afterEach, describe, expect, it, vi } from "vitest";

import { account, session, user } from "../../../src/schema";
import { createDrizzleIamIdentityStore } from "../../../src/adapters/drizzle";

function createUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...overrides,
  };
}

describe("createDrizzleIamIdentityStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a user and credential account in one transaction", async () => {
    const createdUser = createUserRow();

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
      transaction: vi.fn(
        async (callback: (value: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("user-1")
      .mockReturnValueOnce("account-1");

    const store = createDrizzleIamIdentityStore({ db: db as any });

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

  it("lists users with paging metadata", async () => {
    const rows = [
      createUserRow(),
      createUserRow({
        id: "user-2",
        email: "bob@example.com",
        name: "Bob",
        role: "viewer",
      }),
    ];
    const listOffset = vi.fn(async () => rows);
    const listLimit = vi.fn(() => ({
      offset: listOffset,
    }));
    const listOrderBy = vi.fn(() => ({
      limit: listLimit,
    }));
    const listWhere = vi.fn(() => ({
      orderBy: listOrderBy,
    }));
    const countWhere = vi.fn(async () => [{ total: 7 }]);
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: listWhere,
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: countWhere,
          })),
        }),
    };

    const store = createDrizzleIamIdentityStore({ db: db as any });

    await expect(
      store.listUsers({
        limit: 2,
        offset: 4,
        sortBy: "email",
        sortOrder: "desc",
        name: "al",
        banned: false,
      }),
    ).resolves.toEqual({
      data: rows,
      total: 7,
      limit: 2,
      offset: 4,
    });

    expect(listWhere).toHaveBeenCalledOnce();
    expect(listOrderBy).toHaveBeenCalledOnce();
    expect(listLimit).toHaveBeenCalledWith(2);
    expect(listOffset).toHaveBeenCalledWith(4);
    expect(countWhere).toHaveBeenCalledOnce();
  });

  it("finds users by id and email and returns null when they are missing", async () => {
    const foundById = createUserRow();
    const foundByEmail = createUserRow({
      id: "user-2",
      email: "bob@example.com",
      name: "Bob",
    });
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [foundById]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [foundByEmail]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        }),
    };

    const store = createDrizzleIamIdentityStore({ db: db as any });

    await expect(store.findUserById("user-1")).resolves.toEqual(foundById);
    await expect(store.findUserByEmail("bob@example.com")).resolves.toEqual(
      foundByEmail,
    );
    await expect(store.findUserById("missing")).resolves.toBeNull();
  });

  it("updates mutable user fields and clears bans on unban", async () => {
    const updatedUser = createUserRow({
      name: "Alice Cooper",
      email: "alice.cooper@example.com",
      role: "viewer",
    });
    const unbannedUser = createUserRow({
      banned: false,
      banReason: null,
      banExpires: null,
    });
    const firstWhere = vi.fn(() => ({
      returning: vi.fn(async () => [updatedUser]),
    }));
    const firstSet = vi.fn(() => ({
      where: firstWhere,
    }));
    const secondWhere = vi.fn(() => ({
      returning: vi.fn(async () => [unbannedUser]),
    }));
    const secondSet = vi.fn(() => ({
      where: secondWhere,
    }));
    const db = {
      update: vi
        .fn()
        .mockReturnValueOnce({
          set: firstSet,
        })
        .mockReturnValueOnce({
          set: secondSet,
        }),
    };

    const store = createDrizzleIamIdentityStore({ db: db as any });

    await expect(
      store.updateUser({
        id: "user-1",
        name: "Alice Cooper",
        email: "alice.cooper@example.com",
        role: "viewer",
      }),
    ).resolves.toEqual(updatedUser);
    await expect(store.unbanUser("user-1")).resolves.toEqual(unbannedUser);
  });

  it("updates credentials, deletes sessions, and exposes last-session metadata", async () => {
    const lastSession = new Date("2026-03-01T02:00:00.000Z");
    const db = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [
              {
                id: "account-1",
                userId: "user-1",
                providerId: "credential",
                password: "hashed-password-2",
              },
            ]),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: "account-1",
                  userId: "user-1",
                  providerId: "credential",
                  password: "hashed-password",
                },
              ]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [createUserRow()]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => [
                  {
                    createdAt: lastSession,
                    ipAddress: "127.0.0.1",
                  },
                ]),
              })),
            })),
          })),
        }),
    };

    const store = createDrizzleIamIdentityStore({ db: db as any });

    await expect(store.getCredentialByUserId("user-1")).resolves.toEqual({
      id: "account-1",
      userId: "user-1",
      providerId: "credential",
      password: "hashed-password",
    });
    await expect(
      store.updateCredentialPassword({
        userId: "user-1",
        passwordHash: "hashed-password-2",
      }),
    ).resolves.toEqual({
      id: "account-1",
      userId: "user-1",
      providerId: "credential",
      password: "hashed-password-2",
    });
    await expect(store.deleteSessionsForUser("user-1")).resolves.toBeUndefined();
    await expect(store.getUserWithLastSession("user-1")).resolves.toEqual({
      user: createUserRow(),
      lastSessionAt: lastSession,
      lastSessionIp: "127.0.0.1",
    });
  });

  it("bans users and clears sessions in a transaction", async () => {
    const updatedUser = createUserRow({
      banned: true,
      banReason: "policy",
    });
    const tx = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [updatedUser]),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    };
    const db = {
      transaction: vi.fn(
        async (callback: (value: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };

    const store = createDrizzleIamIdentityStore({ db: db as any });

    await expect(
      store.banUser({
        id: "user-1",
        banReason: "policy",
      }),
    ).resolves.toEqual(updatedUser);
    expect(tx.delete).toHaveBeenCalledWith(session);
  });
});
