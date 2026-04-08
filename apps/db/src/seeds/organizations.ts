import { eq } from "drizzle-orm";

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
        isActive: true,
        signatureKey: null,
        sealKey: null,
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
          isActive: true,
          signatureKey: null,
          sealKey: null,
        },
      });

    const [profile] = await db
      .insert(schema.partyProfiles)
      .values({
        organizationId: organization.id,
        counterpartyId: null,
        fullName: organization.fullName,
        shortName: organization.shortName,
        fullNameI18n: null,
        shortNameI18n: null,
        legalFormCode: organization.orgType ?? null,
        legalFormLabel: organization.orgType ?? null,
        legalFormLabelI18n: null,
        countryCode: organization.country ?? null,
        businessActivityCode: null,
        businessActivityText: organization.description ?? null,
      })
      .onConflictDoUpdate({
        target: schema.partyProfiles.organizationId,
        set: {
          fullName: organization.fullName,
          shortName: organization.shortName,
          fullNameI18n: null,
          shortNameI18n: null,
          legalFormCode: organization.orgType ?? null,
          legalFormLabel: organization.orgType ?? null,
          legalFormLabelI18n: null,
          countryCode: organization.country ?? null,
          businessActivityCode: null,
          businessActivityText: organization.description ?? null,
        },
      })
      .returning({ id: schema.partyProfiles.id });
    const profileId = profile?.id;
    if (!profileId) {
      throw new Error(
        `[seed:organizations] Failed to upsert legal profile for ${organization.id}`,
      );
    }

    await db
      .delete(schema.partyIdentifiers)
      .where(eq(schema.partyIdentifiers.partyProfileId, profileId));
    await db
      .delete(schema.partyAddresses)
      .where(eq(schema.partyAddresses.partyProfileId, profileId));
    await db
      .delete(schema.partyContacts)
      .where(eq(schema.partyContacts.partyProfileId, profileId));
    await db
      .delete(schema.partyRepresentatives)
      .where(eq(schema.partyRepresentatives.partyProfileId, profileId));
    await db
      .delete(schema.partyLicenses)
      .where(eq(schema.partyLicenses.partyProfileId, profileId));

    const identifiers = [
      organization.inn
        ? {
            partyProfileId: profileId,
            scheme: "inn",
            value: organization.inn,
            normalizedValue: organization.inn,
          }
        : null,
      organization.taxId
        ? {
            partyProfileId: profileId,
            scheme: "tax_id",
            value: organization.taxId,
            normalizedValue: organization.taxId,
          }
        : null,
      organization.kpp
        ? {
            partyProfileId: profileId,
            scheme: "kpp",
            value: organization.kpp,
            normalizedValue: organization.kpp,
          }
        : null,
    ].filter((item) => item !== null);

    if (identifiers.length > 0) {
      await db.insert(schema.partyIdentifiers).values(identifiers);
    }

    if (organization.address) {
      await db.insert(schema.partyAddresses).values({
        partyProfileId: profileId,
        countryCode: organization.country ?? null,
        postalCode: null,
        city: organization.city ?? null,
        streetAddress: null,
        addressDetails: null,
        fullAddress: organization.address,
      });
    }

    if (organization.directorName) {
      await db.insert(schema.partyRepresentatives).values({
        partyProfileId: profileId,
        role: "director",
        fullName: organization.directorName,
        fullNameI18n: null,
        title: null,
        titleI18n: null,
        basisDocument: null,
        basisDocumentI18n: null,
        isPrimary: true,
      });
    }
  }

  console.log(`[seed:organizations] Seeded ${ORGANIZATIONS.length} organizations`);
}
