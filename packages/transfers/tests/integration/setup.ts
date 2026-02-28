import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createClient } from "tigerbeetle-node";
import { afterAll, afterEach, beforeAll } from "vitest";

import { seedAccounting, seedCurrencies } from "@bedrock/db/seeds";
import { schema } from "@bedrock/db/schema";

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
  replica_addresses: [process.env.TB_ADDRESS || "3000"],
};

const pool = new Pool(testDbConfig);
const db = drizzle(pool, { schema });
const tb = createClient(tbConfig);

const RESET_SQL = `
  TRUNCATE TABLE
    settlements,
    fee_payment_orders,
    fx_quote_fee_components,
    fx_quote_legs,
    fx_quotes,
    fee_rules,
    payment_orders,
    transfer_events,
    transfer_orders,
    outbox,
    tb_transfer_plans,
    postings,
    ledger_operations,
    book_account_instances,
    operational_account_bindings,
    operational_accounts,
    operational_account_providers,
    customers,
    counterparty_group_memberships,
    counterparty_groups,
    counterparties
  RESTART IDENTITY CASCADE
`;

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
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function resetTables() {
  await pool.query(RESET_SQL);
}

beforeAll(async () => {
  console.log("Setting up transfers integration test environment...");

  await pool.query("SELECT 1");
  await assertTigerBeetleReady();
  await resetTables();
  await seedCurrencies(db);
  await seedAccounting(db);

  console.log("Transfers integration test environment ready");
}, 30000);

afterEach(async () => {
  await resetTables();
});

afterAll(async () => {
  console.log("Tearing down transfers integration test environment...");

  tb.destroy();
  await pool.end();

  console.log("Transfers integration test environment cleaned up");
}, 30000);

export { db };
