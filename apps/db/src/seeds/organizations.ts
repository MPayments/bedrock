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
      .insert(schema.partyLegalProfiles)
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
        target: schema.partyLegalProfiles.organizationId,
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
      .returning({ id: schema.partyLegalProfiles.id });
    const profileId = profile?.id;
    if (!profileId) {
      throw new Error(
        `[seed:organizations] Failed to upsert legal profile for ${organization.id}`,
      );
    }

    await db
      .delete(schema.partyLegalIdentifiers)
      .where(eq(schema.partyLegalIdentifiers.partyLegalProfileId, profileId));
    await db
      .delete(schema.partyAddresses)
      .where(eq(schema.partyAddresses.partyLegalProfileId, profileId));
    await db
      .delete(schema.partyContacts)
      .where(eq(schema.partyContacts.partyLegalProfileId, profileId));
    await db
      .delete(schema.partyRepresentatives)
      .where(eq(schema.partyRepresentatives.partyLegalProfileId, profileId));
    await db
      .delete(schema.partyLicenses)
      .where(eq(schema.partyLicenses.partyLegalProfileId, profileId));

    const identifiers = [
      organization.inn
        ? {
            partyLegalProfileId: profileId,
            scheme: "inn",
            value: organization.inn,
            normalizedValue: organization.inn,
          }
        : null,
      organization.taxId
        ? {
            partyLegalProfileId: profileId,
            scheme: "tax_id",
            value: organization.taxId,
            normalizedValue: organization.taxId,
          }
        : null,
      organization.kpp
        ? {
            partyLegalProfileId: profileId,
            scheme: "kpp",
            value: organization.kpp,
            normalizedValue: organization.kpp,
          }
        : null,
    ].filter((item) => item !== null);

    if (identifiers.length > 0) {
      await db.insert(schema.partyLegalIdentifiers).values(identifiers);
    }

    if (organization.address) {
      await db.insert(schema.partyAddresses).values({
        partyLegalProfileId: profileId,
        label: null,
        countryCode: organization.country ?? null,
        postalCode: null,
        city: organization.city ?? null,
        line1: null,
        line2: null,
        rawText: organization.address,
        isPrimary: true,
      });
    }

    if (organization.directorName) {
      await db.insert(schema.partyRepresentatives).values({
        partyLegalProfileId: profileId,
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
