import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
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
        description: organization.description ?? null,
        kind: organization.kind,
        country: organization.country ?? null,
        orgType: organization.orgType ?? null,
        city: organization.city ?? null,
        address: organization.address ?? null,
        inn: organization.inn ?? null,
        taxId: organization.taxId ?? null,
        kpp: organization.kpp ?? null,
        directorName: organization.directorName ?? null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: schema.organizations.id,
        set: {
          externalId: organization.externalId,
          shortName: organization.shortName,
          fullName: organization.fullName,
          description: organization.description ?? null,
          kind: organization.kind,
          country: organization.country ?? null,
          orgType: organization.orgType ?? null,
          city: organization.city ?? null,
          address: organization.address ?? null,
          inn: organization.inn ?? null,
          taxId: organization.taxId ?? null,
          kpp: organization.kpp ?? null,
          directorName: organization.directorName ?? null,
          isActive: true,
        },
      });
  }

  console.log(`[seed:organizations] Seeded ${ORGANIZATIONS.length} organizations`);
}
