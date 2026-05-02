import { inArray } from "drizzle-orm";

import type { Database } from "../client";
import { schema } from "../schema-registry";
import { seedCurrencies } from "./currencies";
import {
  ORGANIZATION_IDS,
  REQUISITE_IDS,
  REQUISITE_PROVIDER_IDS,
} from "./fixtures";
import { seedOrganizations } from "./organizations";
import { seedRequisiteProviders } from "./requisite-providers";
import { seedRequisites } from "./requisites";

const REQUIRED_MANAGED_ORGANIZATION_IDS = [
  ORGANIZATION_IDS.BINTANG_UTARA_TRADING,
] as const;

const REQUIRED_MANAGED_PROVIDER_IDS = [
  REQUISITE_PROVIDER_IDS.BANK_NEGARA_INDONESIA,
  REQUISITE_PROVIDER_IDS.BANK_MANDIRI,
] as const;

const REQUIRED_MANAGED_REQUISITE_IDS = [
  REQUISITE_IDS.BINTANG_BNI_IDR,
  REQUISITE_IDS.BINTANG_BNI_USD,
  REQUISITE_IDS.BINTANG_BNI_EUR,
  REQUISITE_IDS.BINTANG_BNI_JPY,
  REQUISITE_IDS.BINTANG_BNI_KRW,
  REQUISITE_IDS.BINTANG_MANDIRI_USD,
  REQUISITE_IDS.BINTANG_MANDIRI_IDR,
] as const;

async function existingOrganizationIds(
  db: Database,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const rows = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(inArray(schema.organizations.id, [...ids]));

  return new Set(rows.map((row) => row.id));
}

async function existingProviderIds(
  db: Database,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const rows = await db
    .select({ id: schema.requisiteProviders.id })
    .from(schema.requisiteProviders)
    .where(inArray(schema.requisiteProviders.id, [...ids]));

  return new Set(rows.map((row) => row.id));
}

async function existingRequisiteIds(
  db: Database,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const rows = await db
    .select({ id: schema.requisites.id })
    .from(schema.requisites)
    .where(inArray(schema.requisites.id, [...ids]));

  return new Set(rows.map((row) => row.id));
}

function missingIds(ids: readonly string[], existing: ReadonlySet<string>) {
  return ids.filter((id) => !existing.has(id));
}

export async function seedRequiredManagedParties(db: Database): Promise<void> {
  await seedCurrencies(db);

  const missingOrganizationIds = missingIds(
    REQUIRED_MANAGED_ORGANIZATION_IDS,
    await existingOrganizationIds(db, REQUIRED_MANAGED_ORGANIZATION_IDS),
  );
  if (missingOrganizationIds.length > 0) {
    await seedOrganizations(db, { organizationIds: missingOrganizationIds });
  }

  const missingProviderIds = missingIds(
    REQUIRED_MANAGED_PROVIDER_IDS,
    await existingProviderIds(db, REQUIRED_MANAGED_PROVIDER_IDS),
  );
  if (missingProviderIds.length > 0) {
    await seedRequisiteProviders(db, { providerIds: missingProviderIds });
  }

  const missingRequisiteIds = missingIds(
    REQUIRED_MANAGED_REQUISITE_IDS,
    await existingRequisiteIds(db, REQUIRED_MANAGED_REQUISITE_IDS),
  );
  if (missingRequisiteIds.length > 0) {
    await seedRequisites(db, {
      requisiteIds: missingRequisiteIds,
      seedDependencies: false,
    });
  }

  console.log(
    [
      "[seed:managed-parties] Missing fixtures inserted:",
      `${missingOrganizationIds.length} organizations,`,
      `${missingProviderIds.length} providers,`,
      `${missingRequisiteIds.length} requisites`,
    ].join(" "),
  );
}
