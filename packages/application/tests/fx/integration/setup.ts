import { schema } from "@bedrock/application/fx/schema";

import { seedCurrencies } from "../../../../db/src/seeds/index.ts";
import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "../../support/integration/postgres";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, schema);

async function cleanupFxRateTables() {
    await pool.query("DELETE FROM fx_rates");
    await pool.query("DELETE FROM fx_rate_sources");
}

registerPgIntegrationLifecycle({
  name: "FX",
  pool,
  cleanup: cleanupFxRateTables,
  setup: async () => {
    await seedCurrencies(db);
  },
});

export { db, pool };
