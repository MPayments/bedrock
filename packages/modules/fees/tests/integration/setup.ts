import { schema } from "@bedrock/fees/schema";
import {
  createTestDrizzleDb,
  createTestPgPool,
  deleteIfTableExists,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

import { seedCurrencies } from "../helpers";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, schema);

async function ensureTestCurrencies() {
  await seedCurrencies(db);
}

async function cleanupFeeTables() {
  await deleteIfTableExists(pool, "document_links");
  await deleteIfTableExists(pool, "document_operations");
  await deleteIfTableExists(pool, "documents");
  await pool.query("DELETE FROM fx_quote_fee_components");
  await pool.query("DELETE FROM fx_quote_legs");
  await pool.query("DELETE FROM fx_quotes");
  await pool.query("DELETE FROM fee_rules");
}

registerPgIntegrationLifecycle({
  name: "fees",
  pool,
  cleanup: cleanupFeeTables,
  setup: ensureTestCurrencies,
});

export { db };
