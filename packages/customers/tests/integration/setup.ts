import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll } from "vitest";

import { schema } from "@bedrock/db/schema";
import { seedCurrencies } from "@bedrock/db/seeds";

const testDbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: +(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  ssl: false,
};

const pool = new Pool(testDbConfig);
const db = drizzle(pool, { schema });

async function cleanupCustomerTables() {
  await pool.query("DELETE FROM transfer_events");
  await pool.query("DELETE FROM transfer_orders");
  await pool.query("DELETE FROM settlements");
  await pool.query("DELETE FROM fee_payment_orders");
  await pool.query("DELETE FROM payment_orders");
  await pool.query("DELETE FROM operational_account_bindings");
  await pool.query("DELETE FROM operational_accounts");
  await pool.query("DELETE FROM operational_account_providers");
  await pool.query("DELETE FROM counterparty_group_memberships");
  await pool.query("DELETE FROM counterparty_groups");
  await pool.query("DELETE FROM counterparties");
  await pool.query("DELETE FROM customers");
}

beforeAll(async () => {
  console.log("Setting up customers integration test environment...");
  await pool.query("SELECT 1");
  await cleanupCustomerTables();
  await seedCurrencies(db);
  console.log("Customers integration test environment ready");
}, 30000);

afterEach(async () => {
  try {
    await cleanupCustomerTables();
  } catch (error) {
    console.error("Customers integration cleanup error:", error);
  }
});

afterAll(async () => {
  console.log("Tearing down customers integration test environment...");
  await pool.end();
  console.log("Customers integration test environment cleaned up");
}, 30000);

export { db, pool };
