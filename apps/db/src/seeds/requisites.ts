import { eq } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/accounting/constants";
import {
  DrizzleBookAccountStore,
  DrizzleBooksStore,
} from "@bedrock/ledger/adapters/drizzle";
import { schema as requisitesSchema } from "@bedrock/parties/schema";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { seedCounterparties } from "./counterparties";
import { seedCurrencies } from "./currencies";
import { REQUISITES, type SeedRequisiteFixture } from "./fixtures";
import { ORGANIZATION_IDS, seedOrganizations } from "./organizations";
import { seedRequisiteProviders } from "./requisite-providers";

export { REQUISITE_IDS } from "./fixtures";

type DbLike = Database | Transaction;

interface ResolvedProviderRef {
  providerId: string;
  branchId: string | null;
}

async function currencyIdByCodeMap(db: DbLike) {
  const out = new Map<string, string>();
  const rows = await db
    .select({ id: schema.currencies.id, code: schema.currencies.code })
    .from(schema.currencies);

  for (const row of rows) {
    out.set(row.code, row.id);
  }

  return out;
}

async function bicToProviderBranchMap(
  db: DbLike,
): Promise<Map<string, ResolvedProviderRef>> {
  const rows = await db
    .select({
      branchId: schema.requisiteProviderBranches.id,
      providerId: schema.requisiteProviderBranches.providerId,
      normalizedValue: schema.requisiteProviderBranchIdentifiers.normalizedValue,
    })
    .from(schema.requisiteProviderBranchIdentifiers)
    .innerJoin(
      schema.requisiteProviderBranches,
      eq(
        schema.requisiteProviderBranches.id,
        schema.requisiteProviderBranchIdentifiers.branchId,
      ),
    )
    .where(eq(schema.requisiteProviderBranchIdentifiers.scheme, "bic"));

  const out = new Map<string, ResolvedProviderRef>();
  for (const row of rows) {
    out.set(row.normalizedValue, {
      providerId: row.providerId,
      branchId: row.branchId,
    });
  }
  return out;
}

function resolveRequisiteProvider(
  requisite: SeedRequisiteFixture,
  bicMap: ReadonlyMap<string, ResolvedProviderRef>,
): ResolvedProviderRef {
  if (requisite.providerBic) {
    const normalized = requisite.providerBic.trim().toUpperCase();
    const resolved = bicMap.get(normalized);
    if (!resolved) {
      throw new Error(
        `[seed:requisites] Requisite ${requisite.id} (${requisite.label}) references BIC ${requisite.providerBic}, but no provider/branch was found in the CBR directory. Ensure seedBicDirectory ran before seedRequisites.`,
      );
    }
    return resolved;
  }

  if (requisite.providerId) {
    return { providerId: requisite.providerId, branchId: null };
  }

  throw new Error(
    `[seed:requisites] Requisite ${requisite.id} (${requisite.label}) has neither providerId nor providerBic`,
  );
}

async function ensureDefaultBooks(db: DbLike): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const books = new DrizzleBooksStore(db);

  for (const organizationId of Object.values(ORGANIZATION_IDS)) {
    const { bookId } = await books.ensureDefaultOrganizationBook({
      organizationId,
    });
    out.set(organizationId, bookId);
  }

  return out;
}

async function upsertRequisites(
  db: DbLike,
  currencyIds: ReadonlyMap<string, string>,
  bicMap: ReadonlyMap<string, ResolvedProviderRef>,
) {
  for (const requisite of REQUISITES) {
    const currencyId = currencyIds.get(requisite.currencyCode);
    if (!currencyId) {
      throw new Error(`Currency not found for code ${requisite.currencyCode}`);
    }

    const { providerId, branchId } = resolveRequisiteProvider(requisite, bicMap);

    await db
      .insert(requisitesSchema.requisites)
      .values({
        id: requisite.id,
        ownerType: requisite.ownerType,
        organizationId:
          requisite.ownerType === "organization" ? requisite.ownerId : null,
        counterpartyId:
          requisite.ownerType === "counterparty" ? requisite.ownerId : null,
        providerId,
        providerBranchId: branchId,
        currencyId,
        kind: requisite.kind,
        label: requisite.label,
        beneficiaryName: requisite.beneficiaryName ?? null,
        beneficiaryNameLocal: null,
        beneficiaryAddress: null,
        paymentPurposeTemplate: null,
        notes: requisite.notes ?? requisite.description ?? null,
        isDefault: requisite.isDefault ?? false,
      })
      .onConflictDoUpdate({
        target: requisitesSchema.requisites.id,
        set: {
          ownerType: requisite.ownerType,
          organizationId:
            requisite.ownerType === "organization" ? requisite.ownerId : null,
          counterpartyId:
            requisite.ownerType === "counterparty" ? requisite.ownerId : null,
          providerId,
          providerBranchId: branchId,
          currencyId,
          kind: requisite.kind,
          label: requisite.label,
          beneficiaryName: requisite.beneficiaryName ?? null,
          beneficiaryNameLocal: null,
          beneficiaryAddress: null,
          paymentPurposeTemplate: null,
          notes: requisite.notes ?? requisite.description ?? null,
          isDefault: requisite.isDefault ?? false,
          archivedAt: null,
        },
      });

    await db
      .delete(requisitesSchema.requisiteIdentifiers)
      .where(eq(requisitesSchema.requisiteIdentifiers.requisiteId, requisite.id));

    const identifiers = [
      requisite.accountNo
        ? {
            requisiteId: requisite.id,
            scheme: "local_account_number",
            value: requisite.accountNo,
            normalizedValue: requisite.accountNo,
            isPrimary: true,
          }
        : null,
      requisite.iban
        ? {
            requisiteId: requisite.id,
            scheme: "iban",
            value: requisite.iban,
            normalizedValue: requisite.iban,
            isPrimary: true,
          }
        : null,
      requisite.address
        ? {
            requisiteId: requisite.id,
            scheme: "wallet_address",
            value: requisite.address,
            normalizedValue: requisite.address,
            isPrimary: true,
          }
        : null,
      requisite.memoTag
        ? {
            requisiteId: requisite.id,
            scheme: "memo_tag",
            value: requisite.memoTag,
            normalizedValue: requisite.memoTag,
            isPrimary: true,
          }
        : null,
      requisite.accountRef
        ? {
            requisiteId: requisite.id,
            scheme: "account_ref",
            value: requisite.accountRef,
            normalizedValue: requisite.accountRef,
            isPrimary: true,
          }
        : null,
      requisite.subaccountRef
        ? {
            requisiteId: requisite.id,
            scheme: "subaccount_ref",
            value: requisite.subaccountRef,
            normalizedValue: requisite.subaccountRef,
            isPrimary: true,
          }
        : null,
      requisite.network
        ? {
            requisiteId: requisite.id,
            scheme: "network",
            value: requisite.network,
            normalizedValue: requisite.network,
            isPrimary: true,
          }
        : null,
      requisite.assetCode
        ? {
            requisiteId: requisite.id,
            scheme: "asset_code",
            value: requisite.assetCode,
            normalizedValue: requisite.assetCode,
            isPrimary: true,
          }
        : null,
      requisite.contact
        ? {
            requisiteId: requisite.id,
            scheme: "contact",
            value: requisite.contact,
            normalizedValue: requisite.contact,
            isPrimary: true,
          }
        : null,
    ].filter((item) => item !== null);

    if (identifiers.length > 0) {
      await db.insert(requisitesSchema.requisiteIdentifiers).values(identifiers);
    }
  }
}

async function upsertOrganizationBindings(
  db: DbLike,
  defaultBookIdByOrganizationId: ReadonlyMap<string, string>,
) {
  const bookAccounts = new DrizzleBookAccountStore(db);
  const organizationRequisites = REQUISITES.filter(
    (
      requisite,
    ): requisite is SeedRequisiteFixture & { ownerType: "organization" } =>
      requisite.ownerType === "organization",
  );

  for (const requisite of organizationRequisites) {
    const bookId = defaultBookIdByOrganizationId.get(requisite.ownerId);
    if (!bookId) {
      throw new Error(`Book not found for organization ${requisite.ownerId}`);
    }

    const dimensions = { organizationRequisiteId: requisite.id };
    const instance = await bookAccounts.ensureBookAccountInstance({
      bookId,
      accountNo: ACCOUNT_NO.BANK,
      currency: requisite.currencyCode,
      dimensions,
    });

    await db
      .insert(requisitesSchema.organizationRequisiteBindings)
      .values({
        requisiteId: requisite.id,
        bookId,
        bookAccountInstanceId: instance.id,
        postingAccountNo: requisite.postingAccountNo ?? ACCOUNT_NO.BANK,
      })
      .onConflictDoUpdate({
        target: requisitesSchema.organizationRequisiteBindings.requisiteId,
        set: {
          bookId,
          bookAccountInstanceId: instance.id,
          postingAccountNo: requisite.postingAccountNo ?? ACCOUNT_NO.BANK,
        },
      });
  }
}

export async function seedRequisites(db: DbLike) {
  await seedCurrencies(db as Database);
  await seedCounterparties(db);
  await seedOrganizations(db);
  await seedRequisiteProviders(db);

  const currencyIds = await currencyIdByCodeMap(db);
  const bicMap = await bicToProviderBranchMap(db);
  await upsertRequisites(db, currencyIds, bicMap);
  const defaultBookIdByOrganizationId = await ensureDefaultBooks(db);
  await upsertOrganizationBindings(db, defaultBookIdByOrganizationId);

  const organizationRequisites = REQUISITES.filter(
    (requisite) => requisite.ownerType === "organization",
  );
  const counterpartyRequisites = REQUISITES.filter(
    (requisite) => requisite.ownerType === "counterparty",
  );

  console.log(
    `[seed:requisites] Seeded ${counterpartyRequisites.length} counterparty requisites, ${organizationRequisites.length} organization requisites, ${organizationRequisites.length} organization bindings`,
  );
}
