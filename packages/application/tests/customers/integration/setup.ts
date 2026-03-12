import { schema } from "@bedrock/application/customers/schema";

import { seedCurrencies } from "../../../../db/src/seeds/index.ts";
import {
  createTestDrizzleDb,
  createTestPgPool,
  deleteIfTableExists,
  registerPgIntegrationLifecycle,
} from "../../support/integration/postgres";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, schema);

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
    await seedCurrencies(db);
  },
});

export { db, pool };
