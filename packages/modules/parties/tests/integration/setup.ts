import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

import { schema as partiesSchema } from "../../src/schema";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, partiesSchema);

async function cleanupPartiesTables() {
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'customer_memberships'
      ) THEN
        DELETE FROM customer_memberships;
      END IF;
    END $$;
  `);
  await pool.query("DELETE FROM organization_requisite_bindings");
  await pool.query("DELETE FROM requisites");
  await pool.query("DELETE FROM requisite_providers");
  await pool.query("DELETE FROM counterparty_group_memberships");
  await pool.query("DELETE FROM counterparty_groups");
  await pool.query("DELETE FROM counterparties");
  await pool.query("DELETE FROM organizations");
  await pool.query("DELETE FROM customers");
}

registerPgIntegrationLifecycle({
  name: "parties",
  pool,
  cleanup: cleanupPartiesTables,
});

export { db, pool };
