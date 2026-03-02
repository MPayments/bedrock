import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll } from "vitest";

import { schema } from "@bedrock/db/schema/fx";

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

async function cleanupFxRateTables() {
    await pool.query("DELETE FROM fx_rates");
    await pool.query("DELETE FROM fx_rate_sources");
}

beforeAll(async () => {
    console.log("Setting up fx integration test environment...");
    await pool.query("SELECT 1");
    await cleanupFxRateTables();
    await seedCurrencies(db);
    console.log("FX integration test environment ready");
}, 30000);

afterEach(async () => {
    try {
        await cleanupFxRateTables();
    } catch (error) {
        console.error("FX integration cleanup error:", error);
    }
});

afterAll(async () => {
    console.log("Tearing down fx integration test environment...");
    await pool.end();
    console.log("FX integration test environment cleaned up");
}, 30000);

export { db, pool };
