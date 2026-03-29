import { afterEach, describe, expect, it, vi } from "vitest";

import {
  account,
  agentProfiles,
  session,
  user,
  userAccessStates,
} from "../../../src/schema";
import {
  DrizzleAgentProfileStore,
  DrizzleCredentialAccountStore,
  DrizzleIamUsersReads,
  DrizzleUserAccountRepository,
  DrizzleUserSessionsStore,
} from "../../../src/adapters/drizzle";
import { UserAccount } from "../../../src/domain/user-account";

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
    twoFactorEnabled: false,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createUserAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return UserAccount.fromSnapshot(createUserRow(overrides) as any);
}

function createTwoFactorSubqueryBuilder() {
  return {
    from: vi.fn(() => ({
      groupBy: vi.fn(() => ({
        as: vi.fn(() => ({ userId: "two_factor_users.user_id" })),
      })),
    })),
  };
}

function createJoinedSelectOneBuilder(result: unknown | null) {
  const limit = vi.fn(async () => (result == null ? [] : [result]));
  const where = vi.fn(() => ({ limit }));
  const joinChain = {
    leftJoin: vi.fn(() => joinChain),
    where,
  };

  return {
    from: vi.fn(() => joinChain),
    where,
    limit,
  };
}

function createJoinedListBuilder(rows: unknown[]) {
  const offset = vi.fn(async () => rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const joinChain = {
    leftJoin: vi.fn(() => joinChain),
    where,
  };

  return {
    from: vi.fn(() => joinChain),
    where,
    orderBy,
    limit,
    offset,
  };
}

function createCountBuilder(total: number) {
  const where = vi.fn(async () => [{ total }]);
  const joinChain = {
    leftJoin: vi.fn(() => joinChain),
    where,
  };

  return {
    from: vi.fn(() => joinChain),
    where,
  };
}

function createSimpleSelectOneBuilder(result: unknown | null) {
  const limit = vi.fn(async () => (result == null ? [] : [result]));
  const where = vi.fn(() => ({ limit }));

  return {
    from: vi.fn(() => ({ where })),
    where,
    limit,
  };
}

function createSessionSelectBuilder(result: unknown | null) {
  const limit = vi.fn(async () => (result == null ? [] : [result]));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));

  return {
    from: vi.fn(() => ({ where })),
    where,
    orderBy,
    limit,
  };
}

describe("IAM drizzle adapters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists users with paging metadata through the reads adapter", async () => {
    const rows = [
      createUserRow(),
      createUserRow({
        id: "user-2",
        email: "bob@example.com",
        name: "Bob",
        role: "viewer",
      }),
    ];
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(createTwoFactorSubqueryBuilder())
        .mockReturnValueOnce(createJoinedListBuilder(rows))
        .mockReturnValueOnce(createCountBuilder(7)),
    };

    const reads = new DrizzleIamUsersReads(db as any);

    await expect(
      reads.listUsers({
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
  });

  it("loads a user with last session metadata through the reads adapter", async () => {
    const lastSession = new Date("2026-03-01T02:00:00.000Z");
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(createTwoFactorSubqueryBuilder())
        .mockReturnValueOnce(createJoinedSelectOneBuilder(createUserRow()))
        .mockReturnValueOnce(
          createSessionSelectBuilder({
            createdAt: lastSession,
            ipAddress: "127.0.0.1",
          }),
        ),
    };

    const reads = new DrizzleIamUsersReads(db as any);

    await expect(reads.getUserWithLastSession("user-1")).resolves.toEqual({
      user: createUserRow(),
      lastSessionAt: lastSession,
      lastSessionIp: "127.0.0.1",
    });
  });

  it("finds and saves user aggregates through the repository", async () => {
    const repositoryDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(createTwoFactorSubqueryBuilder())
        .mockReturnValueOnce(createJoinedSelectOneBuilder(createUserRow()))
        .mockReturnValueOnce(createSimpleSelectOneBuilder(null)),
      insert: vi
        .fn()
        .mockReturnValueOnce({
          values: vi.fn(async () => undefined),
        })
        .mockReturnValueOnce({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn(async () => undefined),
          })),
        }),
    };

    const repository = new DrizzleUserAccountRepository(repositoryDb as any);

    const found = await repository.findById("user-1");
    expect(found?.toSnapshot()).toEqual(createUserAccount().toSnapshot());

    const created = createUserAccount({
      id: "user-2",
      email: "bob@example.com",
      name: "Bob",
      role: "customer",
    });
    const saved = await repository.save(created);

    expect(saved.toSnapshot()).toEqual(created.toSnapshot());
    expect(repositoryDb.insert).toHaveBeenNthCalledWith(1, user);
    expect(repositoryDb.insert).toHaveBeenNthCalledWith(2, userAccessStates);
  });

  it("updates existing users and access state through the repository", async () => {
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    const db = {
      select: vi.fn().mockReturnValueOnce(createSimpleSelectOneBuilder({ id: "user-1" })),
      update: vi.fn(() => ({ set: updateSet })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(async () => undefined),
        })),
      })),
    };

    const repository = new DrizzleUserAccountRepository(db as any);
    const updated = createUserAccount({
      name: "Alice Cooper",
      email: "alice.cooper@example.com",
      banned: true,
      banReason: "policy",
    });

    await expect(repository.save(updated)).resolves.toEqual(updated);
    expect(db.update).toHaveBeenCalledWith(user);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Alice Cooper",
        email: "alice.cooper@example.com",
      }),
    );
  });

  it("handles credential, session, and agent-profile stores", async () => {
    const credentialsDb = {
      select: vi.fn().mockReturnValueOnce(
        createSimpleSelectOneBuilder({
          id: "account-1",
          userId: "user-1",
          providerId: "credential",
          password: "hashed-password",
        }),
      ),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => [
            {
              id: "account-2",
              userId: "user-2",
              providerId: "credential",
              password: "hashed-password-2",
            },
          ]),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [
              {
                id: "account-1",
                userId: "user-1",
                providerId: "credential",
                password: "hashed-password-3",
              },
            ]),
          })),
        })),
      })),
    };
    const sessionDb = {
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    };
    const agentProfileDb = {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(async () => undefined),
        })),
      })),
    };

    const credentials = new DrizzleCredentialAccountStore(credentialsDb as any);
    const sessions = new DrizzleUserSessionsStore(sessionDb as any);
    const agentProfileStore = new DrizzleAgentProfileStore(agentProfileDb as any);

    await expect(credentials.findByUserId("user-1")).resolves.toEqual({
      id: "account-1",
      userId: "user-1",
      providerId: "credential",
      password: "hashed-password",
    });
    await expect(
      credentials.create({
        id: "account-2",
        userId: "user-2",
        passwordHash: "hashed-password-2",
        now: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      id: "account-2",
      userId: "user-2",
      providerId: "credential",
      password: "hashed-password-2",
    });
    await expect(
      credentials.updatePassword({
        userId: "user-1",
        passwordHash: "hashed-password-3",
      }),
    ).resolves.toEqual({
      id: "account-1",
      userId: "user-1",
      providerId: "credential",
      password: "hashed-password-3",
    });
    await expect(sessions.deleteForUser("user-1")).resolves.toBeUndefined();
    await expect(
      agentProfileStore.ensureProvisioned({
        userId: "user-1",
        now: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ).resolves.toBeUndefined();

    expect(sessionDb.delete).toHaveBeenCalledWith(session);
    expect(agentProfileDb.insert).toHaveBeenCalledWith(agentProfiles);
    expect(credentialsDb.insert).toHaveBeenCalledWith(account);
  });
});
