import { describe, expect, it, vi } from "vitest";

import { assertSeedSchemaReady } from "../../src/seeds/runtime";

describe("seed runtime preflight", () => {
  it("allows seeding when required schema tables exist", async () => {
    const db = {
      execute: vi.fn(async () => ({
        rows: [
          {
            migrations: "drizzle.__drizzle_migrations",
            migrationsPublic: null,
            currencies: "public.currencies",
            users: 'public."user"',
          },
        ],
      })),
    };

    await expect(assertSeedSchemaReady(db as never)).resolves.toBeUndefined();
  });

  it("fails with a clear migration message when schema is missing", async () => {
    const db = {
      execute: vi.fn(async () => ({
        rows: [
          {
            migrations: null,
            migrationsPublic: null,
            currencies: null,
            users: null,
          },
        ],
      })),
    };

    await expect(assertSeedSchemaReady(db as never)).rejects.toThrow(
      /Database schema is not ready for seeding\./,
    );
    await expect(assertSeedSchemaReady(db as never)).rejects.toThrow(
      /bun run db:migrate/,
    );
  });
});
