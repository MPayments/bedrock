import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createClient } from "tigerbeetle-node";
import { beforeAll, afterAll, afterEach } from "vitest";

import { schema } from "@bedrock/db/schema";
import { seedCurrencies } from "@bedrock/db/seeds";

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
  replica_addresses: [process.env.TB_ADDRESS || "3000"],
};

const pool = new Pool(testDbConfig);
const db = drizzle(pool, { schema });
const tb = createClient(tbConfig);

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

async function ensureTestCurrencies() {
  await seedCurrencies(db);
}

async function resetTreasuryTables() {
  await pool.query(`
        TRUNCATE TABLE 
            settlements,
            fee_payment_orders,
            fx_quote_fee_components,
            fx_quote_legs,
            fx_quotes,
            fee_rules,
            payment_orders,
            outbox,
            tb_transfer_plans,
            ledger_postings,
            ledger_operations,
            book_accounts,
            operational_accounts_book_bindings,
            operational_accounts,
            operational_account_providers,
            customers,
            counterparty_group_memberships,
            counterparty_groups,
            counterparties
        RESTART IDENTITY CASCADE
    `);
}

async function cleanupTreasuryTables() {
  await pool.query("DELETE FROM settlements");
  await pool.query("DELETE FROM fee_payment_orders");
  await pool.query("DELETE FROM fx_quote_fee_components");
  await pool.query("DELETE FROM fx_quote_legs");
  await pool.query("DELETE FROM fx_quotes");
  await pool.query("DELETE FROM fee_rules");
  await pool.query("DELETE FROM payment_orders");
  await pool.query("DELETE FROM outbox");
  await pool.query("DELETE FROM tb_transfer_plans");
  await pool.query("DELETE FROM ledger_postings");
  await pool.query("DELETE FROM ledger_operations");
  await pool.query("DELETE FROM book_accounts");
  await pool.query("DELETE FROM operational_accounts_book_bindings");
  await pool.query("DELETE FROM operational_accounts");
  await pool.query("DELETE FROM operational_account_providers");
  await pool.query("DELETE FROM counterparty_group_memberships");
  await pool.query("DELETE FROM counterparty_groups");
  await pool.query("DELETE FROM counterparties");
  await pool.query("DELETE FROM customers");
}

beforeAll(async () => {
  console.log("Setting up treasury integration test environment...");

  await pool.query("SELECT 1");
  await assertTigerBeetleReady();
  await resetTreasuryTables();
  await ensureTestCurrencies();

  console.log("Treasury integration test environment ready");
}, 30000);

afterAll(async () => {
  console.log("Tearing down treasury integration test environment...");

  if (tb) {
    tb.destroy();
  }

  if (pool) {
    await pool.end();
  }

  console.log("Treasury integration test environment cleaned up");
}, 30000);

afterEach(async () => {
  if (pool) {
    try {
      await cleanupTreasuryTables();
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  }
});

export { db };
