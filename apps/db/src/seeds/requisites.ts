import { ACCOUNT_NO } from "@bedrock/accounting/constants";
import {
  DrizzleBookAccountStore,
  DrizzleBooksStore,
} from "@bedrock/ledger/adapters/drizzle";
import { schema as requisitesSchema } from "@bedrock/parties/schema";
import { schema as treasurySchema } from "@bedrock/treasury/schema";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { seedCounterparties } from "./counterparties";
import { seedCurrencies } from "./currencies";
import { REQUISITES, type SeedRequisiteFixture } from "./fixtures";
import { ORGANIZATION_IDS, seedOrganizations } from "./organizations";
import { seedRequisiteProviders } from "./requisite-providers";

export { REQUISITE_IDS } from "./fixtures";

type DbLike = Database | Transaction;

function resolveTreasuryAccountKind(kind: SeedRequisiteFixture["kind"]) {
  switch (kind) {
    case "bank":
      return "bank" as const;
    case "exchange":
      return "exchange" as const;
    case "blockchain":
      return "wallet" as const;
    case "custodian":
      return "custodial" as const;
  }
}

function resolveEndpointDescriptor(requisite: SeedRequisiteFixture) {
  if (requisite.kind === "blockchain") {
    const value = requisite.address ?? requisite.accountRef;
    if (!value) {
      throw new Error(`Blockchain requisite ${requisite.id} is missing address`);
    }

    return {
      endpointType: "wallet_address",
      value,
    };
  }

  const value =
    requisite.iban ??
    requisite.accountNo ??
    requisite.accountRef ??
    requisite.subaccountRef;

  if (!value) {
    throw new Error(
      `Requisite ${requisite.id} is missing an addressable endpoint value`,
    );
  }

  return {
    endpointType: requisite.iban
      ? "iban"
      : requisite.accountNo
        ? "account_no"
        : requisite.accountRef
          ? "account_ref"
          : "subaccount_ref",
    value,
  };
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
) {
  for (const requisite of REQUISITES) {
    const currencyId = currencyIds.get(requisite.currencyCode);
    if (!currencyId) {
      throw new Error(`Currency not found for code ${requisite.currencyCode}`);
    }

    await db
      .insert(requisitesSchema.requisites)
      .values({
        id: requisite.id,
        ownerType: requisite.ownerType,
        organizationId:
          requisite.ownerType === "organization" ? requisite.ownerId : null,
        counterpartyId:
          requisite.ownerType === "counterparty" ? requisite.ownerId : null,
        providerId: requisite.providerId,
        currencyId,
        kind: requisite.kind,
        label: requisite.label,
        description: requisite.description ?? null,
        beneficiaryName: requisite.beneficiaryName ?? null,
        institutionName: requisite.institutionName ?? null,
        institutionCountry: requisite.institutionCountry ?? null,
        accountNo: requisite.accountNo ?? null,
        corrAccount: requisite.corrAccount ?? null,
        iban: requisite.iban ?? null,
        bic: requisite.bic ?? null,
        swift: requisite.swift ?? null,
        bankAddress: requisite.bankAddress ?? null,
        network: requisite.network ?? null,
        assetCode: requisite.assetCode ?? null,
        address: requisite.address ?? null,
        memoTag: requisite.memoTag ?? null,
        accountRef: requisite.accountRef ?? null,
        subaccountRef: requisite.subaccountRef ?? null,
        contact: requisite.contact ?? null,
        notes: requisite.notes ?? null,
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
          providerId: requisite.providerId,
          currencyId,
          kind: requisite.kind,
          label: requisite.label,
          description: requisite.description ?? null,
          beneficiaryName: requisite.beneficiaryName ?? null,
          institutionName: requisite.institutionName ?? null,
          institutionCountry: requisite.institutionCountry ?? null,
          accountNo: requisite.accountNo ?? null,
          corrAccount: requisite.corrAccount ?? null,
          iban: requisite.iban ?? null,
          bic: requisite.bic ?? null,
          swift: requisite.swift ?? null,
          bankAddress: requisite.bankAddress ?? null,
          network: requisite.network ?? null,
          assetCode: requisite.assetCode ?? null,
          address: requisite.address ?? null,
          memoTag: requisite.memoTag ?? null,
          accountRef: requisite.accountRef ?? null,
          subaccountRef: requisite.subaccountRef ?? null,
          contact: requisite.contact ?? null,
          notes: requisite.notes ?? null,
          isDefault: requisite.isDefault ?? false,
          archivedAt: null,
        },
      });
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

async function upsertTreasuryResources(
  db: DbLike,
  currencyIds: ReadonlyMap<string, string>,
) {
  const organizationRequisites = REQUISITES.filter(
    (
      requisite,
    ): requisite is SeedRequisiteFixture & { ownerType: "organization" } =>
      requisite.ownerType === "organization",
  );
  const counterpartyRequisites = REQUISITES.filter(
    (
      requisite,
    ): requisite is SeedRequisiteFixture & { ownerType: "counterparty" } =>
      requisite.ownerType === "counterparty",
  );

  for (const requisite of organizationRequisites) {
    const assetId = currencyIds.get(requisite.currencyCode);
    if (!assetId) {
      throw new Error(`Currency not found for code ${requisite.currencyCode}`);
    }

    const endpoint = resolveEndpointDescriptor(requisite);

    await db
      .insert(treasurySchema.treasuryAccounts)
      .values({
        id: requisite.id,
        kind: resolveTreasuryAccountKind(requisite.kind),
        ownerEntityId: requisite.ownerId,
        operatorEntityId: requisite.ownerId,
        assetId,
        provider: requisite.providerId,
        networkOrRail: requisite.network ?? null,
        accountReference: `requisite:${requisite.id}`,
        reconciliationMode: null,
        finalityModel: null,
        segregationModel: null,
        canReceive: true,
        canSend: true,
        metadata: {
          label: requisite.label,
          institutionName: requisite.institutionName ?? null,
          beneficiaryName: requisite.beneficiaryName ?? null,
          accountNo: requisite.accountNo ?? null,
          iban: requisite.iban ?? null,
          swift: requisite.swift ?? null,
          address: requisite.address ?? null,
          accountRef: requisite.accountRef ?? null,
          subaccountRef: requisite.subaccountRef ?? null,
        },
      })
      .onConflictDoUpdate({
        target: treasurySchema.treasuryAccounts.id,
        set: {
          kind: resolveTreasuryAccountKind(requisite.kind),
          ownerEntityId: requisite.ownerId,
          operatorEntityId: requisite.ownerId,
          assetId,
          provider: requisite.providerId,
          networkOrRail: requisite.network ?? null,
          accountReference: `requisite:${requisite.id}`,
          reconciliationMode: null,
          finalityModel: null,
          segregationModel: null,
          canReceive: true,
          canSend: true,
          metadata: {
            label: requisite.label,
            institutionName: requisite.institutionName ?? null,
            beneficiaryName: requisite.beneficiaryName ?? null,
            accountNo: requisite.accountNo ?? null,
            iban: requisite.iban ?? null,
            swift: requisite.swift ?? null,
            address: requisite.address ?? null,
            accountRef: requisite.accountRef ?? null,
            subaccountRef: requisite.subaccountRef ?? null,
          },
          archivedAt: null,
        },
      });

    await db
      .insert(treasurySchema.treasuryEndpoints)
      .values({
        id: requisite.id,
        accountId: requisite.id,
        endpointType: endpoint.endpointType,
        value: endpoint.value,
        label: requisite.label,
        memoTag: requisite.memoTag ?? null,
        metadata: {
          providerId: requisite.providerId,
          kind: requisite.kind,
        },
      })
      .onConflictDoUpdate({
        target: treasurySchema.treasuryEndpoints.id,
        set: {
          accountId: requisite.id,
          endpointType: endpoint.endpointType,
          value: endpoint.value,
          label: requisite.label,
          memoTag: requisite.memoTag ?? null,
          metadata: {
            providerId: requisite.providerId,
            kind: requisite.kind,
          },
          archivedAt: null,
        },
      });
  }

  for (const requisite of counterpartyRequisites) {
    const assetId = currencyIds.get(requisite.currencyCode);
    if (!assetId) {
      throw new Error(`Currency not found for code ${requisite.currencyCode}`);
    }

    const endpoint = resolveEndpointDescriptor(requisite);

    await db
      .insert(treasurySchema.counterpartyEndpoints)
      .values({
        id: requisite.id,
        counterpartyId: requisite.ownerId,
        assetId,
        endpointType: endpoint.endpointType,
        value: endpoint.value,
        label: requisite.label,
        memoTag: requisite.memoTag ?? null,
        metadata: {
          providerId: requisite.providerId,
          kind: requisite.kind,
        },
      })
      .onConflictDoUpdate({
        target: treasurySchema.counterpartyEndpoints.id,
        set: {
          counterpartyId: requisite.ownerId,
          assetId,
          endpointType: endpoint.endpointType,
          value: endpoint.value,
          label: requisite.label,
          memoTag: requisite.memoTag ?? null,
          metadata: {
            providerId: requisite.providerId,
            kind: requisite.kind,
          },
          archivedAt: null,
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
  await upsertRequisites(db, currencyIds);
  const defaultBookIdByOrganizationId = await ensureDefaultBooks(db);
  await upsertOrganizationBindings(db, defaultBookIdByOrganizationId);
  await upsertTreasuryResources(db, currencyIds);

  const organizationRequisites = REQUISITES.filter(
    (requisite) => requisite.ownerType === "organization",
  );
  const counterpartyRequisites = REQUISITES.filter(
    (requisite) => requisite.ownerType === "counterparty",
  );

  console.log(
    `[seed:requisites] Seeded ${counterpartyRequisites.length} counterparty requisites, ${organizationRequisites.length} organization requisites, ${organizationRequisites.length} organization bindings, ${organizationRequisites.length} treasury accounts, ${organizationRequisites.length} treasury endpoints, ${counterpartyRequisites.length} counterparty endpoints`,
  );
}
