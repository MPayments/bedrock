import { and, eq } from "drizzle-orm";

import {
  computeDimensionsHash,
  tbBookAccountInstanceIdFor,
  tbLedgerForCurrency,
} from "@multihansa/common";
import { ACCOUNT_NO } from "@multihansa/accounting";

import type { Database } from "../client";
import { schema } from "../schema";
import { seedCounterparties } from "./counterparties";
import { seedCurrencies } from "./currencies";
import { REQUISITES, type SeedRequisiteFixture } from "./fixtures";
import { ORGANIZATION_IDS, seedOrganizations } from "./organizations";
import { seedRequisiteProviders } from "./requisite-providers";

export { REQUISITE_IDS } from "./fixtures";

function organizationDefaultBookCode(organizationId: string) {
  return `organization-default:${organizationId}`;
}

function organizationDefaultBookName(organizationId: string) {
  return `Organization ${organizationId} default book`;
}

async function currencyIdByCodeMap(db: Database) {
  const out = new Map<string, string>();
  const rows = await db
    .select({ id: schema.currencies.id, code: schema.currencies.code })
    .from(schema.currencies);

  for (const row of rows) {
    out.set(row.code, row.id);
  }

  return out;
}

async function ensureDefaultBooks(
  db: Database,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  for (const organizationId of Object.values(ORGANIZATION_IDS)) {
    const [existing] = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(
        and(
          eq(schema.books.organizationId, organizationId),
          eq(schema.books.isDefault, true),
        ),
      )
      .limit(1);

    if (existing) {
      out.set(organizationId, existing.id);
      continue;
    }

    const code = organizationDefaultBookCode(organizationId);
    const [created] = await db
      .insert(schema.books)
      .values({
        organizationId,
        code,
        name: organizationDefaultBookName(organizationId),
        isDefault: true,
      })
      .onConflictDoNothing({ target: schema.books.code })
      .returning({ id: schema.books.id });

    if (created) {
      out.set(organizationId, created.id);
      continue;
    }

    const [byCode] = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(eq(schema.books.code, code))
      .limit(1);

    if (!byCode) {
      throw new Error(
        `Failed to create or fetch default book for organization ${organizationId}`,
      );
    }

    out.set(organizationId, byCode.id);
  }

  return out;
}

async function upsertRequisites(
  db: Database,
  currencyIds: ReadonlyMap<string, string>,
) {
  for (const requisite of REQUISITES) {
    const currencyId = currencyIds.get(requisite.currencyCode);
    if (!currencyId) {
      throw new Error(`Currency not found for code ${requisite.currencyCode}`);
    }

    await db
      .insert(schema.requisites)
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
        target: schema.requisites.id,
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
  db: Database,
  defaultBookIdByOrganizationId: ReadonlyMap<string, string>,
) {
  const organizationRequisites = REQUISITES.filter(
    (requisite): requisite is SeedRequisiteFixture & { ownerType: "organization" } =>
      requisite.ownerType === "organization",
  );

  for (const requisite of organizationRequisites) {
    const bookId = defaultBookIdByOrganizationId.get(requisite.ownerId);
    if (!bookId) {
      throw new Error(`Book not found for organization ${requisite.ownerId}`);
    }

    const dimensions = { organizationRequisiteId: requisite.id };
    const dimensionsHash = computeDimensionsHash(dimensions);
    const tbLedger = tbLedgerForCurrency(requisite.currencyCode);
    const tbAccountId = tbBookAccountInstanceIdFor(
      bookId,
      ACCOUNT_NO.BANK,
      requisite.currencyCode,
      dimensionsHash,
      tbLedger,
    );

    const [instance] = await db
      .insert(schema.bookAccountInstances)
      .values({
        bookId,
        accountNo: ACCOUNT_NO.BANK,
        currency: requisite.currencyCode,
        dimensions,
        dimensionsHash,
        tbLedger,
        tbAccountId,
      })
      .onConflictDoUpdate({
        target: [
          schema.bookAccountInstances.bookId,
          schema.bookAccountInstances.accountNo,
          schema.bookAccountInstances.currency,
          schema.bookAccountInstances.dimensionsHash,
        ],
        set: {
          tbLedger,
          tbAccountId,
          dimensions,
        },
      })
      .returning({ id: schema.bookAccountInstances.id });

    if (!instance) {
      throw new Error(
        `Failed to upsert organization binding instance for requisite ${requisite.id}`,
      );
    }

    await db
      .insert(schema.requisiteAccountingBindings)
      .values({
        requisiteId: requisite.id,
        bookId,
        bookAccountInstanceId: instance.id,
        postingAccountNo: requisite.postingAccountNo ?? ACCOUNT_NO.BANK,
      })
      .onConflictDoUpdate({
        target: schema.requisiteAccountingBindings.requisiteId,
        set: {
          bookId,
          bookAccountInstanceId: instance.id,
          postingAccountNo: requisite.postingAccountNo ?? ACCOUNT_NO.BANK,
        },
      });
  }
}

export async function seedRequisites(db: Database) {
  await seedCurrencies(db);
  await seedCounterparties(db);
  await seedOrganizations(db);
  await seedRequisiteProviders(db);

  const currencyIds = await currencyIdByCodeMap(db);
  await upsertRequisites(db, currencyIds);
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
