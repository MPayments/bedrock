import type { Database, Transaction } from "@bedrock/db/client";
import { schema } from "@bedrock/db";
import { ORGANIZATIONS } from "./fixtures";

export { ORGANIZATION_IDS } from "./fixtures";

export async function seedOrganizations(db: Database | Transaction) {
  for (const organization of ORGANIZATIONS) {
    await db
      .insert(schema.organizations)
      .values({
        id: organization.id,
        externalId: organization.externalId,
        shortName: organization.shortName,
        fullName: organization.fullName,
        description: organization.description,
        kind: organization.kind,
        country: organization.country,
      })
      .onConflictDoUpdate({
        target: schema.organizations.id,
        set: {
          externalId: organization.externalId,
          shortName: organization.shortName,
          fullName: organization.fullName,
          description: organization.description,
          kind: organization.kind,
          country: organization.country,
        },
      });
  }

  console.log(`[seed:organizations] Seeded ${ORGANIZATIONS.length} organizations`);
}
