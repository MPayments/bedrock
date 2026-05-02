import { eq } from "drizzle-orm";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { REQUISITE_PROVIDERS } from "./fixtures";

export { REQUISITE_PROVIDER_IDS } from "./fixtures";

export interface SeedRequisiteProvidersOptions {
  providerIds?: readonly string[];
}

function selectProviders(options: SeedRequisiteProvidersOptions) {
  if (!options.providerIds) {
    return REQUISITE_PROVIDERS;
  }

  const allowed = new Set(options.providerIds);
  return REQUISITE_PROVIDERS.filter((provider) => allowed.has(provider.id));
}

export async function seedRequisiteProviders(
  db: Database | Transaction,
  options: SeedRequisiteProvidersOptions = {},
) {
  const targetProviders = selectProviders(options);

  for (const provider of targetProviders) {
    await db
      .insert(schema.requisiteProviders)
      .values({
        id: provider.id,
        kind: provider.kind,
        legalName: provider.legalName,
        legalNameI18n: provider.legalNameI18n ?? null,
        displayName: provider.displayName,
        displayNameI18n: provider.displayNameI18n ?? null,
        description: provider.description,
        country: provider.country,
        website: provider.contact?.startsWith("http") ? provider.contact : null,
      })
      .onConflictDoUpdate({
        target: schema.requisiteProviders.id,
        set: {
          kind: provider.kind,
          legalName: provider.legalName,
          legalNameI18n: provider.legalNameI18n ?? null,
          displayName: provider.displayName,
          displayNameI18n: provider.displayNameI18n ?? null,
          description: provider.description,
          country: provider.country,
          website: provider.contact?.startsWith("http") ? provider.contact : null,
          archivedAt: null,
        },
      });

    await db
      .delete(schema.requisiteProviderIdentifiers)
      .where(eq(schema.requisiteProviderIdentifiers.providerId, provider.id));
    await db
      .delete(schema.requisiteProviderBranches)
      .where(eq(schema.requisiteProviderBranches.providerId, provider.id));

    const identifiers = [
      provider.bic
        ? {
            providerId: provider.id,
            scheme: "bic",
            value: provider.bic,
            normalizedValue: provider.bic,
            isPrimary: true,
          }
        : null,
      provider.swift
        ? {
            providerId: provider.id,
            scheme: "swift",
            value: provider.swift,
            normalizedValue: provider.swift,
            isPrimary: true,
          }
        : null,
      provider.corrAccount
        ? {
            providerId: provider.id,
            scheme: "corr_account",
            value: provider.corrAccount,
            normalizedValue: provider.corrAccount,
            isPrimary: true,
          }
        : null,
    ].filter((item) => item !== null);

    if (identifiers.length > 0) {
      await db.insert(schema.requisiteProviderIdentifiers).values(identifiers);
    }

    if (provider.address || provider.contact) {
      await db.insert(schema.requisiteProviderBranches).values({
        providerId: provider.id,
        code: null,
        name: provider.displayName,
        nameI18n: provider.displayNameI18n ?? null,
        country: provider.country,
        postalCode: null,
        city: null,
        cityI18n: null,
        line1: null,
        line1I18n: null,
        line2: null,
        line2I18n: null,
        rawAddress: provider.address,
        rawAddressI18n: provider.addressI18n ?? null,
        contactEmail:
          provider.contact && provider.contact.includes("@")
            ? provider.contact
            : null,
        contactPhone: null,
        isPrimary: true,
        archivedAt: null,
      });
    }
  }

  console.log(
    `[seed:requisite-providers] Seeded ${targetProviders.length} requisite providers`,
  );
}
