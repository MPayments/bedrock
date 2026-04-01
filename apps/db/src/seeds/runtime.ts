import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { loadSeedEnv } from "./load-env";

type SeedSchemaProbeDb = Pick<Database, "execute">;

interface SeedSchemaProbeRow {
  currencies: string | null;
  migrations: string | null;
  migrationsPublic: string | null;
  portalAccessGrants: string | null;
  users: string | null;
}

export async function assertSeedSchemaReady(
  db: SeedSchemaProbeDb,
): Promise<void> {
  const result = await db.execute(sql`
    SELECT
      to_regclass('drizzle.__drizzle_migrations') AS migrations,
      to_regclass('public.__drizzle_migrations') AS "migrationsPublic",
      to_regclass('public.currencies') AS currencies,
      to_regclass('public.portal_access_grants') AS "portalAccessGrants",
      to_regclass('public."user"') AS users
  `);

  const [row] = (result.rows ?? []) as unknown as SeedSchemaProbeRow[];
  const missingTables = [
    row?.migrations || row?.migrationsPublic ? null : "__drizzle_migrations",
    row?.currencies ? null : "currencies",
    row?.portalAccessGrants ? null : "portal_access_grants",
    row?.users ? null : "user",
  ].filter((value): value is string => value !== null);

  if (missingTables.length === 0) {
    return;
  }

  throw new Error(
    [
      "Database schema is not ready for seeding.",
      `Missing tables: ${missingTables.join(", ")}.`,
      "Apply the schema before running seeders:",
      "  bun run db:migrate",
      "  bun run db:seed",
      "If you changed the migration baseline or need a clean reset, use:",
      "  bun run db:nuke",
      "  bun run db:migrate",
      "  bun run db:seed",
    ].join("\n"),
  );
}

export async function loadSeedDatabase(): Promise<Database> {
  loadSeedEnv();

  const { db } = await import("../client");
  await assertSeedSchemaReady(db);

  return db;
}
