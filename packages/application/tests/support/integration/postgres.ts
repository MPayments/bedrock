import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll } from "vitest";

export const TEST_DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: false,
};

export function createTestPgPool() {
  return new Pool(TEST_DB_CONFIG);
}

export function createTestDrizzleDb<TSchema>(pool: Pool, schema: TSchema) {
  return drizzle(pool, { schema });
}

export async function deleteIfTableExists(pool: Pool, tableName: string) {
  const result = await pool.query<{ exists: string | null }>(
    "select to_regclass($1) as exists",
    [`public.${tableName}`],
  );

  if (result.rows[0]?.exists) {
    await pool.query(`DELETE FROM ${tableName}`);
  }
}

export function registerPgIntegrationLifecycle(input: {
  name: string;
  pool: Pool;
  cleanup: () => Promise<void>;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  beforeAllTimeoutMs?: number;
  afterAllTimeoutMs?: number;
}) {
  beforeAll(async () => {
    console.log(`Setting up ${input.name} integration test environment...`);
    await input.pool.query("SELECT 1");
    await input.cleanup();
    await input.setup?.();
    console.log(`${input.name} integration test environment ready`);
  }, input.beforeAllTimeoutMs ?? 30000);

  afterEach(async () => {
    try {
      await input.cleanup();
    } catch (error) {
      console.error(`${input.name} integration cleanup error:`, error);
    }
  });

  afterAll(async () => {
    console.log(`Tearing down ${input.name} integration test environment...`);
    await input.teardown?.();
    await input.pool.end();
    console.log(`${input.name} integration test environment cleaned up`);
  }, input.afterAllTimeoutMs ?? 30000);
}
