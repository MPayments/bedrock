import {
  createTestDrizzleDb,
  createTestPgPool,
  deleteIfTableExists,
  registerPgIntegrationLifecycle,
} from "../../../packages/tooling/test-utils/src/bedrock/integration/postgres";
import { schema as agreementsSchema } from "../../../packages/modules/agreements/src/schema";
import { schema as calculationsSchema } from "../../../packages/modules/calculations/src/schema";
import { schema as currenciesSchema } from "../../../packages/modules/currencies/src/infra/drizzle/schema/index";
import { schema as dealsSchema } from "../../../packages/modules/deals/src/schema";
import { schema as ledgerSchema } from "../../../packages/modules/ledger/src/schema";
import { schema as partiesSchema } from "../../../packages/modules/parties/src/schema";
import { schema as treasurySchema } from "../../../packages/modules/treasury/src/schema";

import { seedCurrencies } from "../../../packages/modules/treasury/tests/helpers";
import { assertIntegrationDbSchemaState } from "../preflight";
import { COMMERCIAL_CORE_ACTOR_USER_ID } from "./fixtures";

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, {
  ...agreementsSchema,
  ...calculationsSchema,
  ...currenciesSchema,
  ...dealsSchema,
  ...ledgerSchema,
  ...partiesSchema,
  ...treasurySchema,
});

async function cleanupCommercialCoreTables() {
  await deleteIfTableExists(pool, "deal_operational_positions");
  await deleteIfTableExists(pool, "deal_timeline_events");
  await deleteIfTableExists(pool, "treasury_cash_movements");
  await deleteIfTableExists(pool, "treasury_execution_fees");
  await deleteIfTableExists(pool, "treasury_execution_fills");
  await deleteIfTableExists(pool, "deal_capability_states");
  await deleteIfTableExists(pool, "deal_approvals");
  await deleteIfTableExists(pool, "deal_calculation_links");
  await deleteIfTableExists(pool, "deal_legs");
  await deleteIfTableExists(pool, "deal_route_cost_components");
  await deleteIfTableExists(pool, "deal_route_legs");
  await deleteIfTableExists(pool, "deal_route_participants");
  await deleteIfTableExists(pool, "deal_route_versions");
  await deleteIfTableExists(pool, "deal_routes");
  await deleteIfTableExists(pool, "deal_participants");
  await deleteIfTableExists(pool, "deals");

  await deleteIfTableExists(pool, "calculation_lines");
  await deleteIfTableExists(pool, "calculation_snapshots");
  await deleteIfTableExists(pool, "calculations");

  await deleteIfTableExists(pool, "agreement_fee_rules");
  await deleteIfTableExists(pool, "agreement_parties");
  await deleteIfTableExists(pool, "agreement_versions");
  await deleteIfTableExists(pool, "agreements");

  await deleteIfTableExists(pool, "fx_quote_fee_components");
  await deleteIfTableExists(pool, "fx_quote_financial_lines");
  await deleteIfTableExists(pool, "fx_quote_legs");
  await deleteIfTableExists(pool, "fx_quotes");

  await deleteIfTableExists(pool, "organization_requisite_bindings");
  await pool.query(
    "DELETE FROM book_account_instances WHERE book_id IN (SELECT id FROM books WHERE code LIKE 'itest-commercial-%')",
  );
  await pool.query("DELETE FROM books WHERE code LIKE 'itest-commercial-%'");

  await deleteIfTableExists(pool, "requisites");
  await deleteIfTableExists(pool, "requisite_providers");
  await deleteIfTableExists(pool, "counterparty_group_memberships");
  await deleteIfTableExists(pool, "counterparty_groups");
  await deleteIfTableExists(pool, "counterparties");
  await deleteIfTableExists(pool, "organizations");
  await deleteIfTableExists(pool, "customers");
}

registerPgIntegrationLifecycle({
  name: "commercial-core",
  pool,
  cleanup: cleanupCommercialCoreTables,
  setup: async () => {
    await assertIntegrationDbSchemaState(pool);
    await pool.query(
      `
        insert into "user" (
          id,
          name,
          email,
          email_verified,
          role
        )
        values ($1, 'Commercial Core Admin', 'commercial-core-admin@bedrock.test', true, 'admin')
        on conflict (id) do nothing
      `,
      [COMMERCIAL_CORE_ACTOR_USER_ID],
    );
    await seedCurrencies(db);
  },
});

export { db, pool };
