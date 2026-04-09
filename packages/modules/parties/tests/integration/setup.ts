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
    TRUNCATE TABLE
      agreement_parties,
      agreements,
      customer_counterparty_assignments,
      documents,
      organization_requisite_bindings,
      party_profiles,
      requisite_identifiers,
      requisite_provider_branch_identifiers,
      requisite_provider_branches,
      requisite_provider_identifiers,
      requisites,
      requisite_providers,
      sub_agent_profiles,
      counterparty_group_memberships,
      counterparty_groups,
      counterparties,
      organizations,
      customers
    RESTART IDENTITY CASCADE
  `);
}

registerPgIntegrationLifecycle({
  name: "parties",
  pool,
  cleanup: cleanupPartiesTables,
});

export { db, pool };
