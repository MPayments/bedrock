import { beforeAll, afterAll, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "@bedrock/db/schema";
import { seedAccounting } from "@bedrock/db/seeds";
import { createClient } from "tigerbeetle-node";

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

  // Clean all test data at the start
  try {
    await pool.query(
      "TRUNCATE TABLE outbox, tb_transfer_plans, postings, ledger_operations, book_account_instances RESTART IDENTITY CASCADE",
    );
  } catch (error) {
    console.error("Initial cleanup error:", error);
  }

  await seedAccounting(db);

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
    try {
      // Use DELETE instead of TRUNCATE to avoid exclusive locks
      // Delete in reverse dependency order
      await pool.query("DELETE FROM outbox");
      await pool.query("DELETE FROM tb_transfer_plans");
      await pool.query("DELETE FROM postings");
      await pool.query("DELETE FROM ledger_operations");
      await pool.query("DELETE FROM book_account_instances");
    } catch (error) {
      console.error("Cleanup error:", error);
      // If cleanup fails, try to continue anyway
    }
  }
});

export { db, tb, pool };
