import {
  createTestDrizzleDb,
  createTestPgPool,
  deleteIfTableExists,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

import { seedCurrencies } from "./helpers";
import { schema as customersSchema } from "../../../src/schema";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, customersSchema);

async function cleanupCustomerTables() {
  await deleteIfTableExists(pool, "document_links");
  await deleteIfTableExists(pool, "document_operations");
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

registerPgIntegrationLifecycle({
  name: "customers",
  pool,
  cleanup: cleanupCustomerTables,
  setup: async () => {
    await seedCurrencies(pool);
  },
});

export { db, pool };
