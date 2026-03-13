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
  ssl: false
};

const tbConfig = {
  cluster_id: BigInt(process.env.TB_CLUSTER_ID || "1"),
  replica_addresses: [process.env.TB_ADDRESS || "3000"]
};

// Initialize connections immediately at module load time
const pool = new Pool(testDbConfig);
const db = drizzle(pool, { schema });
const tb = createClient(tbConfig);
const TEST_BOOK_ID = randomUUID();
const TEST_BOOK_CODE = `it-ledger-book-${TEST_BOOK_ID.slice(0, 8)}`;
const INTERNAL_LEDGER_GROUP_CODE = "treasury_internal_entities";
const TREASURY_ROOT_GROUP_CODE = "treasury";
const TEST_INTERNAL_COUNTERPARTY_ID = "00000000-0000-4000-8000-00000000f203";

async function resolveInternalLedgerCounterpartyId(): Promise<string> {
  const result = await pool.query<{
    counterparty_id: string;
  }>(
    `
      SELECT m.counterparty_id::text AS counterparty_id
      FROM counterparty_group_memberships m
      INNER JOIN counterparty_groups g ON g.id = m.group_id
      WHERE g.code = $1
      ORDER BY m.counterparty_id
      LIMIT 1
    `,
    [INTERNAL_LEDGER_GROUP_CODE],
  );

  const existingRow = result.rows[0];
  if (existingRow) {
    return existingRow.counterparty_id;
  }

  await pool.query(
    `
      INSERT INTO counterparty_groups (code, name, description, parent_id, customer_id, is_system)
      VALUES ($1, 'Treasury', 'System root for treasury counterparties', NULL, NULL, true)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          parent_id = NULL,
          customer_id = NULL,
          is_system = true
    `,
    [TREASURY_ROOT_GROUP_CODE],
  );

  const rootResult = await pool.query<{ id: string }>(
    "SELECT id::text AS id FROM counterparty_groups WHERE code = $1 LIMIT 1",
    [TREASURY_ROOT_GROUP_CODE],
  );
  const treasuryRootGroupId = rootResult.rows[0]?.id;
  if (!treasuryRootGroupId) {
    throw new Error("Failed to resolve treasury root group for integration test");
  }

  await pool.query(
    `
      INSERT INTO counterparty_groups (code, name, description, parent_id, customer_id, is_system)
      VALUES ($1, 'Treasury Internal Ledger Entities', 'Integration test internal entities', $2::uuid, NULL, true)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          parent_id = EXCLUDED.parent_id,
          customer_id = NULL,
          is_system = true
    `,
    [INTERNAL_LEDGER_GROUP_CODE, treasuryRootGroupId],
  );

  const internalGroupResult = await pool.query<{ id: string }>(
    "SELECT id::text AS id FROM counterparty_groups WHERE code = $1 LIMIT 1",
    [INTERNAL_LEDGER_GROUP_CODE],
  );
  const internalGroupId = internalGroupResult.rows[0]?.id;
  if (!internalGroupId) {
    throw new Error("Failed to resolve treasury internal ledger group for integration test");
  }

  await pool.query(
    `
      INSERT INTO counterparties (id, short_name, full_name, kind, country)
      VALUES ($1::uuid, 'Integration Internal Entity', 'Integration Internal Entity', 'legal_entity', 'US')
      ON CONFLICT (id) DO UPDATE
      SET short_name = EXCLUDED.short_name,
          full_name = EXCLUDED.full_name,
          kind = EXCLUDED.kind,
          country = EXCLUDED.country
    `,
    [TEST_INTERNAL_COUNTERPARTY_ID],
  );

  await pool.query(
    `
      INSERT INTO counterparty_group_memberships (counterparty_id, group_id)
      VALUES ($1::uuid, $2::uuid)
      ON CONFLICT (counterparty_id, group_id) DO NOTHING
    `,
    [TEST_INTERNAL_COUNTERPARTY_ID, internalGroupId],
  );

  return TEST_INTERNAL_COUNTERPARTY_ID;
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
      })
    ]);
  } catch (error) {
    throw new Error(
      `TigerBeetle health check failed (address=${tbConfig.replica_addresses[0]}, cluster_id=${tbConfig.cluster_id}): ${formatError(error)}`
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

  const internalCounterpartyId = await resolveInternalLedgerCounterpartyId();
  await db
    .insert(schema.books)
    .values({
      id: TEST_BOOK_ID,
      ownerId: internalCounterpartyId,
      code: TEST_BOOK_CODE,
      name: "Integration Ledger Book",
      isDefault: false,
    })
    .onConflictDoUpdate({
      target: schema.books.id,
      set: {
        ownerId: internalCounterpartyId,
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

export { db, tb, pool, TEST_BOOK_ID };
