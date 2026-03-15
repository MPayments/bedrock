import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import { currencies } from "@bedrock/currencies/schema";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  OrganizationRequisiteOptionRecord,
  OrganizationRequisitesCommandRepository,
  OrganizationRequisitesQueryRepository,
  OrganizationsRequisiteBindingResolution,
} from "../../../application/requisites/ports";
import type {
  OrganizationRequisite,
  OrganizationRequisiteAccountingBinding,
} from "../../../contracts";
import type { OrganizationRequisiteSnapshot } from "../../../domain/organization-requisite";
import {
  organizationRequisiteBindings,
  organizationRequisites,
  type OrganizationRequisiteRow,
} from "../schema";

const REQUISITES_SORT_COLUMN_MAP = {
  label: organizationRequisites.label,
  kind: organizationRequisites.kind,
  createdAt: organizationRequisites.createdAt,
  updatedAt: organizationRequisites.updatedAt,
} as const;

function toSnapshot(
  row: OrganizationRequisiteRow,
): OrganizationRequisiteSnapshot {
  return {
    id: row.id,
    organizationId: row.organizationId!,
    providerId: row.providerId,
    currencyId: row.currencyId,
    kind: row.kind,
    label: row.label,
    description: row.description,
    beneficiaryName: row.beneficiaryName,
    institutionName: row.institutionName,
    institutionCountry: row.institutionCountry,
    accountNo: row.accountNo,
    corrAccount: row.corrAccount,
    iban: row.iban,
    bic: row.bic,
    swift: row.swift,
    bankAddress: row.bankAddress,
    network: row.network,
    assetCode: row.assetCode,
    address: row.address,
    memoTag: row.memoTag,
    accountRef: row.accountRef,
    subaccountRef: row.subaccountRef,
    contact: row.contact,
    notes: row.notes,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function toPublicRequisite(
  snapshot: OrganizationRequisiteSnapshot,
): OrganizationRequisite {
  return {
    id: snapshot.id,
    ownerType: "organization",
    ownerId: snapshot.organizationId,
    providerId: snapshot.providerId,
    currencyId: snapshot.currencyId,
    kind: snapshot.kind,
    label: snapshot.label,
    description: snapshot.description,
    beneficiaryName: snapshot.beneficiaryName,
    institutionName: snapshot.institutionName,
    institutionCountry: snapshot.institutionCountry,
    accountNo: snapshot.accountNo,
    corrAccount: snapshot.corrAccount,
    iban: snapshot.iban,
    bic: snapshot.bic,
    swift: snapshot.swift,
    bankAddress: snapshot.bankAddress,
    network: snapshot.network,
    assetCode: snapshot.assetCode,
    address: snapshot.address,
    memoTag: snapshot.memoTag,
    accountRef: snapshot.accountRef,
    subaccountRef: snapshot.subaccountRef,
    contact: snapshot.contact,
    notes: snapshot.notes,
    isDefault: snapshot.isDefault,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    archivedAt: snapshot.archivedAt,
  };
}

async function findRequisiteSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<OrganizationRequisiteSnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(organizationRequisites)
    .where(
      and(
        eq(organizationRequisites.id, id),
        eq(organizationRequisites.ownerType, "organization"),
      ),
    )
    .limit(1);

  return row ? toSnapshot(row) : null;
}

async function findActiveRequisiteSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<OrganizationRequisiteSnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(organizationRequisites)
    .where(
      and(
        eq(organizationRequisites.id, id),
        eq(organizationRequisites.ownerType, "organization"),
        isNull(organizationRequisites.archivedAt),
      ),
    )
    .limit(1);

  return row ? toSnapshot(row) : null;
}

async function findBinding(
  db: Database,
  requisiteId: string,
  tx?: Transaction,
): Promise<OrganizationRequisiteAccountingBinding | null> {
  const database = tx ?? db;
  const [binding] = await database
    .select({
      requisiteId: organizationRequisiteBindings.requisiteId,
      organizationId: organizationRequisites.organizationId,
      bookId: organizationRequisiteBindings.bookId,
      bookAccountInstanceId:
        organizationRequisiteBindings.bookAccountInstanceId,
      postingAccountNo: organizationRequisiteBindings.postingAccountNo,
      createdAt: organizationRequisiteBindings.createdAt,
      updatedAt: organizationRequisiteBindings.updatedAt,
    })
    .from(organizationRequisiteBindings)
    .innerJoin(
      organizationRequisites,
      eq(
        organizationRequisiteBindings.requisiteId,
        organizationRequisites.id,
      ),
    )
    .where(eq(organizationRequisiteBindings.requisiteId, requisiteId))
    .limit(1);

  if (!binding || !binding.organizationId) {
    return null;
  }

  return {
    requisiteId: binding.requisiteId,
    organizationId: binding.organizationId,
    bookId: binding.bookId,
    bookAccountInstanceId: binding.bookAccountInstanceId,
    postingAccountNo: binding.postingAccountNo,
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt,
  };
}

export function createDrizzleOrganizationRequisitesQueryRepository(
  db: Database,
): OrganizationRequisitesQueryRepository {
  return {
    async findRequisiteById(id) {
      const snapshot = await findRequisiteSnapshot(db, id);
      return snapshot ? toPublicRequisite(snapshot) : null;
    },
    async findActiveRequisiteById(id) {
      const snapshot = await findActiveRequisiteSnapshot(db, id);
      return snapshot ? toPublicRequisite(snapshot) : null;
    },
    async listRequisites(input) {
      const conditions: SQL[] = [
        eq(organizationRequisites.ownerType, "organization"),
        isNull(organizationRequisites.archivedAt),
      ];

      if (input.label) {
        conditions.push(ilike(organizationRequisites.label, `%${input.label}%`));
      }

      if (input.organizationId) {
        conditions.push(
          eq(organizationRequisites.organizationId, input.organizationId),
        );
      }

      if (input.currencyId?.length) {
        conditions.push(
          inArray(organizationRequisites.currencyId, input.currencyId),
        );
      }

      if (input.kind?.length) {
        conditions.push(
          inArray(
            organizationRequisites.kind,
            input.kind as OrganizationRequisite["kind"][],
          ),
        );
      }

      if (input.providerId?.length) {
        conditions.push(
          inArray(organizationRequisites.providerId, input.providerId),
        );
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        REQUISITES_SORT_COLUMN_MAP,
        organizationRequisites.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(organizationRequisites)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(organizationRequisites)
          .where(where),
      ]);

      return {
        data: rows.map((row) => toPublicRequisite(toSnapshot(row))),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<OrganizationRequisite>;
    },
    async listRequisiteOptions(input) {
      const conditions: SQL[] = [
        eq(organizationRequisites.ownerType, "organization"),
        isNull(organizationRequisites.archivedAt),
      ];

      if (input.organizationId) {
        conditions.push(
          eq(organizationRequisites.organizationId, input.organizationId),
        );
      }

      const rows = await db
        .select({
          id: organizationRequisites.id,
          ownerId: organizationRequisites.organizationId,
          providerId: organizationRequisites.providerId,
          currencyId: organizationRequisites.currencyId,
          kind: organizationRequisites.kind,
          label: organizationRequisites.label,
          beneficiaryName: organizationRequisites.beneficiaryName,
          institutionName: organizationRequisites.institutionName,
          institutionCountry: organizationRequisites.institutionCountry,
          accountNo: organizationRequisites.accountNo,
          corrAccount: organizationRequisites.corrAccount,
          iban: organizationRequisites.iban,
          bic: organizationRequisites.bic,
          swift: organizationRequisites.swift,
          bankAddress: organizationRequisites.bankAddress,
          network: organizationRequisites.network,
          assetCode: organizationRequisites.assetCode,
          address: organizationRequisites.address,
          memoTag: organizationRequisites.memoTag,
          accountRef: organizationRequisites.accountRef,
          subaccountRef: organizationRequisites.subaccountRef,
          contact: organizationRequisites.contact,
          notes: organizationRequisites.notes,
          currencyCode: currencies.code,
        })
        .from(organizationRequisites)
        .innerJoin(
          currencies,
          eq(currencies.id, organizationRequisites.currencyId),
        )
        .where(and(...conditions))
        .orderBy(
          asc(organizationRequisites.label),
          asc(organizationRequisites.createdAt),
        );

      return rows.map((row) => ({
        id: row.id,
        ownerId: row.ownerId!,
        currencyId: row.currencyId,
        providerId: row.providerId,
        kind: row.kind,
        label: row.label,
        beneficiaryName: row.beneficiaryName,
        institutionName: row.institutionName,
        institutionCountry: row.institutionCountry,
        accountNo: row.accountNo,
        corrAccount: row.corrAccount,
        iban: row.iban,
        bic: row.bic,
        swift: row.swift,
        bankAddress: row.bankAddress,
        network: row.network,
        assetCode: row.assetCode,
        address: row.address,
        memoTag: row.memoTag,
        accountRef: row.accountRef,
        subaccountRef: row.subaccountRef,
        contact: row.contact,
        notes: row.notes,
        currencyCode: row.currencyCode,
      })) satisfies OrganizationRequisiteOptionRecord[];
    },
    async listLabelsById(ids) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await db
        .select({
          id: organizationRequisites.id,
          label: organizationRequisites.label,
        })
        .from(organizationRequisites)
        .where(
          and(
            eq(organizationRequisites.ownerType, "organization"),
            inArray(organizationRequisites.id, uniqueIds),
          ),
        );

      return new Map(rows.map((row) => [row.id, row.label]));
    },
    async findBindingByRequisiteId(requisiteId) {
      return findBinding(db, requisiteId);
    },
    async listResolvedBindingsById(requisiteIds) {
      const uniqueIds = Array.from(new Set(requisiteIds.filter(Boolean)));

      if (uniqueIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({
          requisiteId: organizationRequisites.id,
          organizationId: organizationRequisites.organizationId,
          bookId: organizationRequisiteBindings.bookId,
          bookAccountInstanceId:
            organizationRequisiteBindings.bookAccountInstanceId,
          currencyId: organizationRequisites.currencyId,
          currencyCode: currencies.code,
          postingAccountNo: organizationRequisiteBindings.postingAccountNo,
        })
        .from(organizationRequisites)
        .innerJoin(
          organizationRequisiteBindings,
          eq(
            organizationRequisiteBindings.requisiteId,
            organizationRequisites.id,
          ),
        )
        .innerJoin(
          currencies,
          eq(currencies.id, organizationRequisites.currencyId),
        )
        .where(
          and(
            eq(organizationRequisites.ownerType, "organization"),
            inArray(organizationRequisites.id, uniqueIds),
          ),
        );

      return rows.map((row) => ({
        requisiteId: row.requisiteId,
        organizationId: row.organizationId!,
        bookId: row.bookId,
        bookAccountInstanceId: row.bookAccountInstanceId,
        currencyId: row.currencyId,
        currencyCode: row.currencyCode,
        postingAccountNo: row.postingAccountNo,
      })) satisfies OrganizationsRequisiteBindingResolution[];
    },
  };
}

export function createDrizzleOrganizationRequisitesCommandRepository(
  db: Database,
): OrganizationRequisitesCommandRepository {
  return {
    async findRequisiteSnapshotById(id, tx) {
      return findRequisiteSnapshot(db, id, tx);
    },
    async findActiveRequisiteSnapshotById(id, tx) {
      return findActiveRequisiteSnapshot(db, id, tx);
    },
    async listActiveRequisitesByOrganizationCurrency(input, tx) {
      const database = tx ?? db;
      const rows = await database
        .select()
        .from(organizationRequisites)
        .where(
          and(
            eq(organizationRequisites.ownerType, "organization"),
            eq(organizationRequisites.organizationId, input.organizationId),
            eq(organizationRequisites.currencyId, input.currencyId),
            isNull(organizationRequisites.archivedAt),
          ),
        )
        .orderBy(
          asc(organizationRequisites.createdAt),
          asc(organizationRequisites.id),
        );

      return rows.map(toSnapshot);
    },
    async insertRequisiteTx(tx, requisite) {
      const [created] = await tx
        .insert(organizationRequisites)
        .values({
          id: requisite.id,
          ownerType: "organization",
          organizationId: requisite.organizationId,
          counterpartyId: null,
          providerId: requisite.providerId,
          currencyId: requisite.currencyId,
          kind: requisite.kind,
          label: requisite.label,
          description: requisite.description,
          beneficiaryName: requisite.beneficiaryName,
          institutionName: requisite.institutionName,
          institutionCountry: requisite.institutionCountry,
          accountNo: requisite.accountNo,
          corrAccount: requisite.corrAccount,
          iban: requisite.iban,
          bic: requisite.bic,
          swift: requisite.swift,
          bankAddress: requisite.bankAddress,
          network: requisite.network,
          assetCode: requisite.assetCode,
          address: requisite.address,
          memoTag: requisite.memoTag,
          accountRef: requisite.accountRef,
          subaccountRef: requisite.subaccountRef,
          contact: requisite.contact,
          notes: requisite.notes,
          isDefault: requisite.isDefault,
          archivedAt: requisite.archivedAt,
        })
        .returning();

      return toSnapshot(created!);
    },
    async updateRequisiteTx(tx, requisite) {
      const [updated] = await tx
        .update(organizationRequisites)
        .set({
          providerId: requisite.providerId,
          currencyId: requisite.currencyId,
          kind: requisite.kind,
          label: requisite.label,
          description: requisite.description,
          beneficiaryName: requisite.beneficiaryName,
          institutionName: requisite.institutionName,
          institutionCountry: requisite.institutionCountry,
          accountNo: requisite.accountNo,
          corrAccount: requisite.corrAccount,
          iban: requisite.iban,
          bic: requisite.bic,
          swift: requisite.swift,
          bankAddress: requisite.bankAddress,
          network: requisite.network,
          assetCode: requisite.assetCode,
          address: requisite.address,
          memoTag: requisite.memoTag,
          accountRef: requisite.accountRef,
          subaccountRef: requisite.subaccountRef,
          contact: requisite.contact,
          notes: requisite.notes,
          isDefault: requisite.isDefault,
          archivedAt: requisite.archivedAt,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(organizationRequisites.id, requisite.id),
            eq(organizationRequisites.ownerType, "organization"),
          ),
        )
        .returning();

      return updated ? toSnapshot(updated) : null;
    },
    async setDefaultStateTx(tx, input) {
      const demotedIds = input.demotedIds.filter((id) => id !== input.defaultId);

      if (demotedIds.length > 0) {
        await tx
          .update(organizationRequisites)
          .set({
            isDefault: false,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(organizationRequisites.ownerType, "organization"),
              eq(organizationRequisites.organizationId, input.organizationId),
              eq(organizationRequisites.currencyId, input.currencyId),
              isNull(organizationRequisites.archivedAt),
              inArray(organizationRequisites.id, demotedIds),
            ),
          );
      }

      if (input.defaultId) {
        await tx
          .update(organizationRequisites)
          .set({
            isDefault: true,
            updatedAt: sql`now()`,
          })
          .where(eq(organizationRequisites.id, input.defaultId));
      }
    },
    async archiveRequisiteTx(tx, input) {
      const [updated] = await tx
        .update(organizationRequisites)
        .set({
          archivedAt: input.archivedAt,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(organizationRequisites.id, input.requisiteId),
            eq(organizationRequisites.ownerType, "organization"),
          ),
        )
        .returning({ id: organizationRequisites.id });

      return Boolean(updated);
    },
    async findBindingByRequisiteId(requisiteId, tx) {
      return findBinding(db, requisiteId, tx);
    },
    async upsertBindingTx(tx, input) {
      await tx
        .insert(organizationRequisiteBindings)
        .values({
          requisiteId: input.requisiteId,
          bookId: input.bookId,
          bookAccountInstanceId: input.bookAccountInstanceId,
          postingAccountNo: input.postingAccountNo,
        })
        .onConflictDoUpdate({
          target: organizationRequisiteBindings.requisiteId,
          set: {
            bookId: input.bookId,
            bookAccountInstanceId: input.bookAccountInstanceId,
            postingAccountNo: input.postingAccountNo,
          },
        });

      return findBinding(db, input.requisiteId, tx);
    },
  };
}
