import { beforeAll, afterAll, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "@bedrock/db/schema";
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
    cluster_id: 0n,
    replica_addresses: [process.env.TB_ADDRESS || "3000"]
};

// Initialize connections immediately at module load time
const pool = new Pool(testDbConfig);
const db = drizzle(pool, { schema });
const tb = createClient(tbConfig);

beforeAll(async () => {
    console.log("Setting up treasury integration test environment...");

    // Verify connection works
    await pool.query("SELECT 1");

    // Clean all test data at the start (order matters for FK constraints)
    try {
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
                journal_lines,
                journal_entries,
                ledger_accounts,
                bank_accounts,
                customers,
                organizations
            RESTART IDENTITY CASCADE
        `);
    } catch (error) {
        console.error("Initial cleanup error:", error);
    }

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
    // Clean up test data after each test (order matters for FK constraints)
    if (pool) {
        try {
            await pool.query("DELETE FROM settlements");
            await pool.query("DELETE FROM fee_payment_orders");
            await pool.query("DELETE FROM fx_quote_fee_components");
            await pool.query("DELETE FROM fx_quote_legs");
            await pool.query("DELETE FROM fx_quotes");
            await pool.query("DELETE FROM fee_rules");
            await pool.query("DELETE FROM payment_orders");
            await pool.query("DELETE FROM outbox");
            await pool.query("DELETE FROM tb_transfer_plans");
            await pool.query("DELETE FROM journal_lines");
            await pool.query("DELETE FROM journal_entries");
            await pool.query("DELETE FROM ledger_accounts");
            await pool.query("DELETE FROM bank_accounts");
            await pool.query("DELETE FROM customers");
            await pool.query("DELETE FROM organizations");
        } catch (error) {
            console.error("Cleanup error:", error);
        }
    }
});

export { db, tb, pool };
