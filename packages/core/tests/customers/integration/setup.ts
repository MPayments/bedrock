import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll } from "vitest";

import { schema } from "@bedrock/core/customers/schema";

import { seedCurrencies } from "../../../../db/src/seeds/index.ts";

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

async function deleteIfTableExists(tableName: string) {
  const result = await pool.query<{ exists: string | null }>(
    "select to_regclass($1) as exists",
    [`public.${tableName}`],
  );

  if (result.rows[0]?.exists) {
    await pool.query(`DELETE FROM ${tableName}`);
  }
}

async function cleanupCustomerTables() {
  await deleteIfTableExists("document_links");
  await deleteIfTableExists("document_operations");
  await pool.query(`
    DELETE FROM documents
    WHERE customer_id IS NOT NULL
      OR counterparty_id IN (
        SELECT id
        FROM counterparties
        WHERE customer_id IS NOT NULL
           OR external_id LIKE 'cp-%'
      )
  `);
  await pool.query(`
    DELETE FROM requisites
    WHERE counterparty_id IN (
      SELECT id
      FROM counterparties
      WHERE customer_id IS NOT NULL
         OR external_id LIKE 'cp-%'
    )
  `);
  await pool.query(`
    DELETE FROM counterparty_group_memberships
    WHERE counterparty_id IN (
      SELECT id
      FROM counterparties
      WHERE customer_id IS NOT NULL
         OR external_id LIKE 'cp-%'
    )
       OR group_id IN (
         SELECT id
         FROM counterparty_groups
         WHERE code LIKE 'customer:%'
            OR code LIKE 'treasury-leaf-%'
       )
  `);
  await pool.query(`
    DELETE FROM counterparty_groups
    WHERE code LIKE 'customer:%'
       OR code LIKE 'treasury-leaf-%'
  `);
  await pool.query(`
    DELETE FROM counterparties
    WHERE customer_id IS NOT NULL
       OR external_id LIKE 'cp-%'
  `);
  await pool.query("DELETE FROM customers WHERE external_ref LIKE 'crm-%'");
}

beforeAll(async () => {
  console.log("Setting up customers integration test environment...");
  await pool.query("SELECT 1");
  await cleanupCustomerTables();
  await seedCurrencies(db);
  console.log("Customers integration test environment ready");
}, 30000);

afterEach(async () => {
  await cleanupCustomerTables();
});

afterAll(async () => {
  console.log("Tearing down customers integration test environment...");
  await pool.end();
  console.log("Customers integration test environment cleaned up");
}, 30000);

export { db, pool };
