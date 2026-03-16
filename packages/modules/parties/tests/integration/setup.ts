import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

import { schema as partiesSchema } from "../../src/infra/drizzle/schema";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, partiesSchema);

async function cleanupPartiesTables() {
  await pool.query("DELETE FROM counterparty_group_memberships");
  await pool.query("DELETE FROM counterparty_groups");
  await pool.query("DELETE FROM counterparties");
  await pool.query("DELETE FROM customers");
}

registerPgIntegrationLifecycle({
  name: "parties",
  pool,
  cleanup: cleanupPartiesTables,
});

export { db, pool };
