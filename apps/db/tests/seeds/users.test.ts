import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  seedBootstrapAdminFromEnv,
  seedUsers,
  USER_IDS,
} from "../../src/seeds/users";

function createSelectChain(results: unknown[][]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => results.shift() ?? []),
      })),
    })),
  };
}

function createDbStub(selectResults: unknown[][]) {
  const inserts: { value: unknown }[] = [];
  const updates: { value: unknown }[] = [];

  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((value: unknown) => {
          inserts.push({ value });
          return {
            onConflictDoNothing: vi.fn(async () => undefined),
            onConflictDoUpdate: vi.fn(async () => undefined),
          };
        }),
      })),
      select: vi.fn(() => createSelectChain(selectResults)),
      update: vi.fn(() => ({
        set: vi.fn((value: unknown) => {
          updates.push({ value });
          return {
            where: vi.fn(async () => undefined),
          };
        }),
      })),
    },
    inserts,
    updates,
  };
}

describe("seedUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repairs the canonical admin user when the fixed id already exists without credentials", async () => {
    const { db, inserts, updates } = createDbStub([
      [{ id: USER_IDS.ADMIN, email: "commercial-core-admin@bedrock.test" }],
      [],
      [],
      [],
      [],
      [],
    ]);
    const hashPassword = vi
      .fn()
      .mockResolvedValueOnce("hashed:admin123")
      .mockResolvedValueOnce("hashed:finance123");

    await seedUsers(db as never, hashPassword);

    expect(updates).toContainEqual({
      value: expect.objectContaining({
        email: "admin@bedrock.com",
        emailVerified: true,
        name: "Admin",
        role: "admin",
      }),
    });
    expect(inserts).toContainEqual({
      value: expect.objectContaining({
        accountId: USER_IDS.ADMIN,
        password: "hashed:admin123",
        providerId: "credential",
        userId: USER_IDS.ADMIN,
      }),
    });
  });

  it("fails fast when the canonical seed email belongs to a different user id", async () => {
    const { db } = createDbStub([
      [],
      [{ id: "other-user-id" }],
      [],
    ]);

    await expect(
      seedUsers(db as never, vi.fn(async () => "hashed")),
    ).rejects.toThrow(
      `User id mismatch for admin@bedrock.com: expected ${USER_IDS.ADMIN}, got other-user-id`,
    );
  });

  it("creates bootstrap admin from env credentials", async () => {
    const { db, inserts } = createDbStub([[], [], []]);
    const hashPassword = vi.fn(async () => "hashed:secret");

    await seedBootstrapAdminFromEnv(db as never, hashPassword, {
      BEDROCK_BOOTSTRAP_ADMIN_EMAIL: "Owner@Example.com ",
      BEDROCK_BOOTSTRAP_ADMIN_NAME: "Owner",
      BEDROCK_BOOTSTRAP_ADMIN_PASSWORD: "secret",
      NODE_ENV: "production",
    });

    expect(hashPassword).toHaveBeenCalledWith("secret");
    expect(inserts).toContainEqual({
      value: expect.objectContaining({
        email: "owner@example.com",
        emailVerified: true,
        name: "Owner",
        role: "admin",
      }),
    });
    expect(inserts).toContainEqual({
      value: expect.objectContaining({
        password: "hashed:secret",
        providerId: "credential",
      }),
    });
  });

  it("requires bootstrap admin env in production", async () => {
    const { db } = createDbStub([]);

    await expect(
      seedBootstrapAdminFromEnv(db as never, vi.fn(async () => "hashed"), {
        NODE_ENV: "production",
      }),
    ).rejects.toThrow(/BEDROCK_BOOTSTRAP_ADMIN_EMAIL/);
  });
});
