import { afterAll, afterEach, beforeAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { seedCurrencies } from "../../../../db/src/seeds/index.ts";
import { schema } from "@bedrock/fees/schema";

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

async function ensureTestCurrencies() {
    await seedCurrencies(db);
}

async function cleanupFeeTables() {
    await deleteIfTableExists("document_links");
    await deleteIfTableExists("document_operations");
    await deleteIfTableExists("documents");
    await pool.query("DELETE FROM fx_quote_fee_components");
    await pool.query("DELETE FROM fx_quote_legs");
    await pool.query("DELETE FROM fx_quotes");
    await pool.query("DELETE FROM fee_rules");
}

beforeAll(async () => {
    console.log("Setting up fees integration test environment...");
    await pool.query("SELECT 1");
    await cleanupFeeTables();
    await ensureTestCurrencies();
    console.log("Fees integration test environment ready");
}, 30000);

afterEach(async () => {
    try {
        await cleanupFeeTables();
    } catch (error) {
        console.error("Fees integration cleanup error:", error);
    }
});

afterAll(async () => {
    console.log("Tearing down fees integration test environment...");
    await pool.end();
    console.log("Fees integration test environment cleaned up");
}, 30000);

export { db };
