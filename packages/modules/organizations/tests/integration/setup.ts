import { inArray } from "drizzle-orm";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import {
  createTestDrizzleDb,
  createTestPgPool,
  registerPgIntegrationLifecycle,
} from "@bedrock/test-utils/bedrock/integration/postgres";

import { schema as organizationsSchema } from "../../src/infra/drizzle/schema";

const schema = {
  ...ledgerSchema,
  ...organizationsSchema,
};

const pool = createTestPgPool();
const db = createTestDrizzleDb(pool, schema);
const trackedBookIds = new Set<string>();
const trackedOrganizationIds = new Set<string>();

export function trackOrganizationId(id: string): void {
  trackedOrganizationIds.add(id);
}

export function trackBookId(id: string): void {
  trackedBookIds.add(id);
}

export async function ensureDeleteGuardTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations_delete_guards (
      organization_id uuid PRIMARY KEY REFERENCES organizations(id)
    )
  `);
}

async function cleanupOrganizationsTables() {
  const organizationIds = Array.from(trackedOrganizationIds);
  const bookIds = Array.from(trackedBookIds);

  if (organizationIds.length > 0) {
    await pool.query(
      "DELETE FROM organizations_delete_guards WHERE organization_id = ANY($1::uuid[])",
      [organizationIds],
    );
  }

  if (bookIds.length > 0) {
    await db.delete(schema.books).where(inArray(schema.books.id, bookIds));
  }

  if (organizationIds.length > 0) {
    await db
      .delete(schema.organizations)
      .where(inArray(schema.organizations.id, organizationIds));
  }

  trackedBookIds.clear();
  trackedOrganizationIds.clear();
}

registerPgIntegrationLifecycle({
  name: "organizations",
  pool,
  cleanup: cleanupOrganizationsTables,
});

export { db, pool };
