import { schema as currenciesSchema } from "@bedrock/currencies/schema";
import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { schema as organizationsSchema } from "@bedrock/organizations/schema";
import { schema as requisitesSchema } from "@bedrock/requisites/schema";
import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

const schema = {
  ...currenciesSchema,
  ...ledgerSchema,
  ...organizationsSchema,
  ...requisitesSchema,
};

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, schema);

async function cleanupPartiesLedgerTables() {
  await pool.query(`
    DELETE FROM organization_requisite_bindings
    WHERE requisite_id IN (
      SELECT id
      FROM requisites
      WHERE label LIKE 'pl-it-%'
    )
  `);
  await pool.query(`
    DELETE FROM book_account_instances
    WHERE book_id IN (
      SELECT id
      FROM books
      WHERE owner_id IN (
        SELECT id
        FROM organizations
        WHERE external_id LIKE 'pl-it-%'
      )
    )
  `);
  await pool.query(`
    DELETE FROM books
    WHERE owner_id IN (
      SELECT id
      FROM organizations
      WHERE external_id LIKE 'pl-it-%'
    )
  `);
  await pool.query(`
    DELETE FROM requisites
    WHERE label LIKE 'pl-it-%'
  `);
  await pool.query(`
    DELETE FROM requisite_providers
    WHERE name LIKE 'pl-it-%'
  `);
  await pool.query(`
    DELETE FROM organizations
    WHERE external_id LIKE 'pl-it-%'
  `);
  await pool.query(`
    DELETE FROM currencies
    WHERE code LIKE 'XPL%'
  `);
}

registerPgIntegrationLifecycle({
  name: "parties-ledger",
  pool,
  cleanup: cleanupPartiesLedgerTables,
});

export { db, pool };
