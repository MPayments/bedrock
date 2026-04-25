import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";
import { schema } from "@bedrock/treasury/schema";

import { seedCurrencies } from "../helpers";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, schema);

async function cleanupTreasuryTables() {
  await pool.query("DELETE FROM payment_step_artifacts");
  await pool.query("DELETE FROM payment_step_attempts");
  await pool.query("DELETE FROM payment_steps");
  await pool.query("DELETE FROM fx_rates");
  await pool.query("DELETE FROM fx_rate_sources");
}

registerPgIntegrationLifecycle({
  name: "Treasury",
  pool,
  cleanup: cleanupTreasuryTables,
  setup: async () => {
    await seedCurrencies(db);
  },
});

export { db };
