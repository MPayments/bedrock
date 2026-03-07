import { and, asc, eq, ne } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/core/accounting";
import { listInternalLedgerCounterparties } from "@bedrock/core/counterparties";

import type { Database, Transaction } from "../client";
import { schema } from "../schema";

type DbLike = Database | Transaction;

type LegacyAccountRow = {
  id: string;
  counterpartyId: string;
  ledgerEntityCounterpartyId: string;
  currencyId: string;
  currencyCode: string;
  label: string;
  description: string | null;
  accountNo: string | null;
  corrAccount: string | null;
  address: string | null;
  iban: string | null;
  createdAt: Date;
  updatedAt: Date;
  counterpartyShortName: string;
  counterpartyFullName: string | null;
  providerType: "bank" | "exchange" | "blockchain" | "custodian";
  providerName: string;
  providerDescription: string | null;
  providerAddress: string | null;
  providerContact: string | null;
  providerBic: string | null;
  providerSwift: string | null;
  providerCountry: string;
  bindingBookId: string | null;
  bindingBookAccountInstanceId: string | null;
  bindingPostingAccountNo: string | null;
};

type BackfillAuditRow = {
  accountId: string;
  reason: string;
  counterpartyId: string;
  ledgerEntityCounterpartyId: string;
  label: string;
};

type BackfillResult = {
  counterpartyRequisites: number;
  organizationRequisites: number;
  organizationBindings: number;
  auditRows: BackfillAuditRow[];
};

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function joinNotes(...parts: Array<string | null | undefined>): string | null {
  const text = parts.filter(hasText).map((part) => part.trim());
  return text.length > 0 ? text.join("\n\n") : null;
}

function mapLegacyFields(row: LegacyAccountRow) {
  const shared = {
    label: row.label,
    description: row.description ?? null,
    beneficiaryName: null as string | null,
    institutionName: null as string | null,
    institutionCountry: null as string | null,
    accountNo: null as string | null,
    corrAccount: null as string | null,
    iban: null as string | null,
    bic: null as string | null,
    swift: null as string | null,
    bankAddress: null as string | null,
    network: null as string | null,
    assetCode: null as string | null,
    address: null as string | null,
    memoTag: null as string | null,
    accountRef: null as string | null,
    subaccountRef: null as string | null,
    contact: row.providerContact ?? null,
    notes: joinNotes(row.description, row.providerDescription),
  };

  switch (row.providerType) {
    case "bank":
      return {
        ...shared,
        kind: row.providerType,
        beneficiaryName: row.counterpartyFullName ?? row.counterpartyShortName,
        institutionName: row.providerName,
        institutionCountry: row.providerCountry,
        accountNo: row.accountNo ?? null,
        corrAccount: row.corrAccount ?? null,
        iban: row.iban ?? null,
        bic: row.providerBic ?? null,
        swift: row.providerSwift ?? null,
        bankAddress: row.address ?? row.providerAddress ?? null,
      };
    case "blockchain":
      return {
        ...shared,
        kind: row.providerType,
        network: row.providerName,
        assetCode: row.currencyCode,
        address: row.address ?? row.accountNo ?? row.iban ?? null,
        memoTag: row.corrAccount ?? null,
      };
    case "exchange":
    case "custodian":
      return {
        ...shared,
        kind: row.providerType,
        institutionName: row.providerName,
        institutionCountry: row.providerCountry,
        accountRef: row.accountNo ?? row.iban ?? row.label,
        subaccountRef: row.corrAccount ?? null,
      };
  }
}

async function loadLegacyAccountRows(db: DbLike): Promise<LegacyAccountRow[]> {
  return db
    .select({
      id: schema.counterpartyAccounts.id,
      counterpartyId: schema.counterpartyAccounts.counterpartyId,
      ledgerEntityCounterpartyId:
        schema.counterpartyAccounts.ledgerEntityCounterpartyId,
      currencyId: schema.counterpartyAccounts.currencyId,
      currencyCode: schema.currencies.code,
      label: schema.counterpartyAccounts.label,
      description: schema.counterpartyAccounts.description,
      accountNo: schema.counterpartyAccounts.accountNo,
      corrAccount: schema.counterpartyAccounts.corrAccount,
      address: schema.counterpartyAccounts.address,
      iban: schema.counterpartyAccounts.iban,
      createdAt: schema.counterpartyAccounts.createdAt,
      updatedAt: schema.counterpartyAccounts.updatedAt,
      counterpartyShortName: schema.counterparties.shortName,
      counterpartyFullName: schema.counterparties.fullName,
      providerType: schema.counterpartyAccountProviders.type,
      providerName: schema.counterpartyAccountProviders.name,
      providerDescription: schema.counterpartyAccountProviders.description,
      providerAddress: schema.counterpartyAccountProviders.address,
      providerContact: schema.counterpartyAccountProviders.contact,
      providerBic: schema.counterpartyAccountProviders.bic,
      providerSwift: schema.counterpartyAccountProviders.swift,
      providerCountry: schema.counterpartyAccountProviders.country,
      bindingBookId: schema.counterpartyAccountBindings.bookId,
      bindingBookAccountInstanceId:
        schema.counterpartyAccountBindings.bookAccountInstanceId,
      bindingPostingAccountNo: schema.bookAccountInstances.accountNo,
    })
    .from(schema.counterpartyAccounts)
    .innerJoin(
      schema.counterparties,
      eq(schema.counterparties.id, schema.counterpartyAccounts.counterpartyId),
    )
    .innerJoin(
      schema.counterpartyAccountProviders,
      eq(
        schema.counterpartyAccountProviders.id,
        schema.counterpartyAccounts.accountProviderId,
      ),
    )
    .innerJoin(
      schema.currencies,
      eq(schema.currencies.id, schema.counterpartyAccounts.currencyId),
    )
    .leftJoin(
      schema.counterpartyAccountBindings,
      eq(
        schema.counterpartyAccountBindings.counterpartyAccountId,
        schema.counterpartyAccounts.id,
      ),
    )
    .leftJoin(
      schema.bookAccountInstances,
      eq(
        schema.bookAccountInstances.id,
        schema.counterpartyAccountBindings.bookAccountInstanceId,
      ),
    )
    .orderBy(
      asc(schema.counterpartyAccounts.counterpartyId),
      asc(schema.counterpartyAccounts.currencyId),
      asc(schema.counterpartyAccounts.createdAt),
      asc(schema.counterpartyAccounts.id),
    );
}

async function setCounterpartyDefault(
  db: DbLike,
  input: { counterpartyId: string; currencyId: string; currentId: string },
) {
  await db
    .update(schema.counterpartyRequisites)
    .set({ isDefault: false })
    .where(
      and(
        eq(schema.counterpartyRequisites.counterpartyId, input.counterpartyId),
        eq(schema.counterpartyRequisites.currencyId, input.currencyId),
        ne(schema.counterpartyRequisites.id, input.currentId),
      ),
    );
}

async function setOrganizationDefault(
  db: DbLike,
  input: { organizationId: string; currencyId: string; currentId: string },
) {
  await db
    .update(schema.organizationRequisites)
    .set({ isDefault: false })
    .where(
      and(
        eq(schema.organizationRequisites.organizationId, input.organizationId),
        eq(schema.organizationRequisites.currencyId, input.currencyId),
        ne(schema.organizationRequisites.id, input.currentId),
      ),
    );
}

export async function backfillRequisitesFromLegacy(
  db: DbLike,
): Promise<BackfillResult> {
  const legacyRows = await loadLegacyAccountRows(db);
  const internalCounterparties = new Set(
    (await listInternalLedgerCounterparties(db)).map((row) => row.id),
  );
  const auditRows: BackfillAuditRow[] = [];
  const defaultCounterpartyKeys = new Set<string>();
  const defaultOrganizationKeys = new Set<string>();
  let counterpartyRequisites = 0;
  let organizationRequisites = 0;
  let organizationBindings = 0;

  for (const row of legacyRows) {
    const fields = mapLegacyFields(row);
    const isInternalOwner = internalCounterparties.has(row.counterpartyId);

    if (isInternalOwner) {
      if (row.counterpartyId !== row.ledgerEntityCounterpartyId) {
        auditRows.push({
          accountId: row.id,
          reason:
            "Internal counterparty account points at a different ledger entity",
          counterpartyId: row.counterpartyId,
          ledgerEntityCounterpartyId: row.ledgerEntityCounterpartyId,
          label: row.label,
        });
        continue;
      }

      const defaultKey = `${row.counterpartyId}:${row.currencyId}`;
      const isDefault = !defaultOrganizationKeys.has(defaultKey);
      defaultOrganizationKeys.add(defaultKey);

      await db
        .insert(schema.organizationRequisites)
        .values({
          id: row.id,
          organizationId: row.counterpartyId,
          currencyId: row.currencyId,
          kind: fields.kind,
          label: fields.label,
          description: fields.description,
          beneficiaryName: fields.beneficiaryName,
          institutionName: fields.institutionName,
          institutionCountry: fields.institutionCountry,
          accountNo: fields.accountNo,
          corrAccount: fields.corrAccount,
          iban: fields.iban,
          bic: fields.bic,
          swift: fields.swift,
          bankAddress: fields.bankAddress,
          network: fields.network,
          assetCode: fields.assetCode,
          address: fields.address,
          memoTag: fields.memoTag,
          accountRef: fields.accountRef,
          subaccountRef: fields.subaccountRef,
          contact: fields.contact,
          notes: fields.notes,
          isDefault,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.organizationRequisites.id,
          set: {
            organizationId: row.counterpartyId,
            currencyId: row.currencyId,
            kind: fields.kind,
            label: fields.label,
            description: fields.description,
            beneficiaryName: fields.beneficiaryName,
            institutionName: fields.institutionName,
            institutionCountry: fields.institutionCountry,
            accountNo: fields.accountNo,
            corrAccount: fields.corrAccount,
            iban: fields.iban,
            bic: fields.bic,
            swift: fields.swift,
            bankAddress: fields.bankAddress,
            network: fields.network,
            assetCode: fields.assetCode,
            address: fields.address,
            memoTag: fields.memoTag,
            accountRef: fields.accountRef,
            subaccountRef: fields.subaccountRef,
            contact: fields.contact,
            notes: fields.notes,
            isDefault,
            updatedAt: row.updatedAt,
          },
        });

      if (isDefault) {
        await setOrganizationDefault(db, {
          organizationId: row.counterpartyId,
          currencyId: row.currencyId,
          currentId: row.id,
        });
      }

      organizationRequisites += 1;

      if (!row.bindingBookId || !row.bindingBookAccountInstanceId) {
        auditRows.push({
          accountId: row.id,
          reason: "Organization requisite is missing a legacy accounting binding",
          counterpartyId: row.counterpartyId,
          ledgerEntityCounterpartyId: row.ledgerEntityCounterpartyId,
          label: row.label,
        });
        continue;
      }

      await db
        .insert(schema.organizationRequisiteBindings)
        .values({
          requisiteId: row.id,
          bookId: row.bindingBookId,
          bookAccountInstanceId: row.bindingBookAccountInstanceId,
          postingAccountNo: row.bindingPostingAccountNo ?? ACCOUNT_NO.BANK,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.organizationRequisiteBindings.requisiteId,
          set: {
            bookId: row.bindingBookId,
            bookAccountInstanceId: row.bindingBookAccountInstanceId,
            postingAccountNo: row.bindingPostingAccountNo ?? ACCOUNT_NO.BANK,
            updatedAt: row.updatedAt,
          },
        });

      organizationBindings += 1;
      continue;
    }

    const defaultKey = `${row.counterpartyId}:${row.currencyId}`;
    const isDefault = !defaultCounterpartyKeys.has(defaultKey);
    defaultCounterpartyKeys.add(defaultKey);

    await db
      .insert(schema.counterpartyRequisites)
      .values({
        id: row.id,
        counterpartyId: row.counterpartyId,
        currencyId: row.currencyId,
        kind: fields.kind,
        label: fields.label,
        description: fields.description,
        beneficiaryName: fields.beneficiaryName,
        institutionName: fields.institutionName,
        institutionCountry: fields.institutionCountry,
        accountNo: fields.accountNo,
        corrAccount: fields.corrAccount,
        iban: fields.iban,
        bic: fields.bic,
        swift: fields.swift,
        bankAddress: fields.bankAddress,
        network: fields.network,
        assetCode: fields.assetCode,
        address: fields.address,
        memoTag: fields.memoTag,
        accountRef: fields.accountRef,
        subaccountRef: fields.subaccountRef,
        contact: fields.contact,
        notes: fields.notes,
        isDefault,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.counterpartyRequisites.id,
        set: {
          counterpartyId: row.counterpartyId,
          currencyId: row.currencyId,
          kind: fields.kind,
          label: fields.label,
          description: fields.description,
          beneficiaryName: fields.beneficiaryName,
          institutionName: fields.institutionName,
          institutionCountry: fields.institutionCountry,
          accountNo: fields.accountNo,
          corrAccount: fields.corrAccount,
          iban: fields.iban,
          bic: fields.bic,
          swift: fields.swift,
          bankAddress: fields.bankAddress,
          network: fields.network,
          assetCode: fields.assetCode,
          address: fields.address,
          memoTag: fields.memoTag,
          accountRef: fields.accountRef,
          subaccountRef: fields.subaccountRef,
          contact: fields.contact,
          notes: fields.notes,
          isDefault,
          updatedAt: row.updatedAt,
        },
      });

    if (isDefault) {
      await setCounterpartyDefault(db, {
        counterpartyId: row.counterpartyId,
        currencyId: row.currencyId,
        currentId: row.id,
      });
    }

    counterpartyRequisites += 1;
  }

  return {
    counterpartyRequisites,
    organizationRequisites,
    organizationBindings,
    auditRows,
  };
}

export async function seedRequisitesFromLegacy(db: DbLike) {
  const result = await backfillRequisitesFromLegacy(db);

  console.log(
    `[seed:requisites] Backfilled ${result.counterpartyRequisites} counterparty requisites, ${result.organizationRequisites} organization requisites, ${result.organizationBindings} organization bindings`,
  );

  if (result.auditRows.length > 0) {
    console.warn(
      `[seed:requisites] ${result.auditRows.length} legacy rows require manual mapping`,
    );
    for (const row of result.auditRows) {
      console.warn(
        `[seed:requisites] audit account=${row.accountId} counterparty=${row.counterpartyId} ledgerEntity=${row.ledgerEntityCounterpartyId} label=${row.label} reason=${row.reason}`,
      );
    }
  }

  return result;
}
