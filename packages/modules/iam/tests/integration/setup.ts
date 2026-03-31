import { schema as partiesSchema } from "@bedrock/parties/schema";
import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

import { schema as iamSchema } from "../../src/schema";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, {
  ...partiesSchema,
  ...iamSchema,
});

async function cleanupIamTables() {
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
  await pool.query("DELETE FROM customers WHERE external_ref LIKE 'iam-test:%'");
  await pool.query(
    "DELETE FROM \"user\" WHERE email LIKE '%@iam-test.example'",
  );
}

registerPgIntegrationLifecycle({
  name: "iam",
  pool,
  cleanup: cleanupIamTables,
});

export { db, pool };
