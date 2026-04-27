import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createClient } from "tigerbeetle-node";
import { beforeAll, afterAll, afterEach } from "vitest";

import { schema } from "@bedrock/ledger/schema";

// Test database and TigerBeetle connection
const testDbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: false,
};

const tbConfig = {
  cluster_id: BigInt(process.env.TB_CLUSTER_ID || "1"),
  replica_addresses: [process.env.TB_ADDRESS || "127.0.0.1:3555"],
};

// Initialize connections immediately at module load time
const pool = new Pool(testDbConfig);
const db = drizzle(pool, { schema });
const tb = createClient(tbConfig);
const TEST_BOOK_ID = randomUUID();
const TEST_BOOK_CODE = `it-ledger-book-${TEST_BOOK_ID.slice(0, 8)}`;
const TEST_INTERNAL_ORGANIZATION_ID = "00000000-0000-4000-8000-00000000f203";

async function resolveInternalLedgerOrganizationId(): Promise<string> {
  const result = await pool.query<{
    organization_id: string;
  }>(
    `
      SELECT id::text AS organization_id
      FROM organizations
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [TEST_INTERNAL_ORGANIZATION_ID],
  );

  const existingRow = result.rows[0];
  if (existingRow) {
    return existingRow.organization_id;
  }

  await pool.query(
    `
      INSERT INTO organizations (id, short_name, full_name, kind, country)
      VALUES ($1::uuid, 'Integration Internal Organization', 'Integration Internal Organization', 'legal_entity', 'US')
      ON CONFLICT (id) DO UPDATE
      SET short_name = EXCLUDED.short_name,
          full_name = EXCLUDED.full_name,
          kind = EXCLUDED.kind,
          country = EXCLUDED.country
    `,
    [TEST_INTERNAL_ORGANIZATION_ID],
  );

  return TEST_INTERNAL_ORGANIZATION_ID;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function assertTigerBeetleReady(timeoutMs = 5000) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      tb.lookupAccounts([0n]),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    throw new Error(
      `TigerBeetle health check failed (address=${tbConfig.replica_addresses[0]}, cluster_id=${tbConfig.cluster_id}): ${formatError(error)}`,
      { cause: error },
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

beforeAll(async () => {
  console.log("Setting up integration test environment...");

  await pool.query("SELECT 1");
  await assertTigerBeetleReady();

  await pool.query(
    "TRUNCATE TABLE outbox, tb_transfer_plans, postings, ledger_operations, book_account_instances RESTART IDENTITY CASCADE",
  );

  const internalOrganizationId = await resolveInternalLedgerOrganizationId();
  await db
    .insert(schema.books)
    .values({
      id: TEST_BOOK_ID,
      ownerId: internalOrganizationId,
      code: TEST_BOOK_CODE,
      name: "Integration Ledger Book",
      isDefault: false,
    })
    .onConflictDoUpdate({
      target: schema.books.id,
      set: {
        ownerId: internalOrganizationId,
        code: TEST_BOOK_CODE,
        name: "Integration Ledger Book",
        isDefault: false,
      },
    });

  console.log("Integration test environment ready");
}, 30000);

afterAll(async () => {
  console.log("Tearing down integration test environment...");

  if (tb) {
    tb.destroy();
  }

  if (pool) {
    await pool.end();
  }

  console.log("Integration test environment cleaned up");
}, 30000);

afterEach(async () => {
  // Clean up test data after each test
  if (pool) {
    // Use DELETE instead of TRUNCATE to avoid exclusive locks.
    // Cleanup must fail loudly to keep test isolation trustworthy.
    await pool.query("DELETE FROM outbox");
    await pool.query("DELETE FROM tb_transfer_plans");
    await pool.query("DELETE FROM postings");
    await pool.query("DELETE FROM ledger_operations");
    await pool.query("DELETE FROM book_account_instances");
  }
});

export { db, tb, TEST_BOOK_ID };
