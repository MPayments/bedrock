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

import type { Database, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type {
  RequisiteOptionRecord,
  RequisitesCommandRepository,
  RequisitesQueryRepository,
} from "../../../application/requisites/ports";
import type { Requisite } from "../../../contracts";
import type { RequisiteOwnerType } from "../../../domain/owner";
import type { RequisiteSnapshot } from "../../../domain/requisite";
import { requisites, type RequisiteRow } from "../schema";

const REQUISITES_SORT_COLUMN_MAP = {
  label: requisites.label,
  kind: requisites.kind,
  createdAt: requisites.createdAt,
  updatedAt: requisites.updatedAt,
} as const;
const currencyCodeSql = sql<string>`(
  select code
  from currencies
  where currencies.id = ${requisites.currencyId}
)`;

function toSnapshot(row: RequisiteRow): RequisiteSnapshot {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerType === "organization" ? row.organizationId! : row.counterpartyId!,
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

function toPublicRequisite(snapshot: RequisiteSnapshot): Requisite {
  return {
    id: snapshot.id,
    ownerType: snapshot.ownerType,
    ownerId: snapshot.ownerId,
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

function ownerIdColumn(ownerType: RequisiteOwnerType) {
  return ownerType === "organization"
    ? requisites.organizationId
    : requisites.counterpartyId;
}

async function findRequisiteSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<RequisiteSnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(requisites)
    .where(eq(requisites.id, id))
    .limit(1);

  return row ? toSnapshot(row) : null;
}

async function findActiveRequisiteSnapshot(
  db: Database,
  id: string,
  tx?: Transaction,
): Promise<RequisiteSnapshot | null> {
  const database = tx ?? db;
  const [row] = await database
    .select()
    .from(requisites)
    .where(and(eq(requisites.id, id), isNull(requisites.archivedAt)))
    .limit(1);

  return row ? toSnapshot(row) : null;
}

export function createDrizzleRequisitesQueryRepository(
  db: Database,
): RequisitesQueryRepository {
  return {
    async findRequisiteById(id, tx) {
      const snapshot = await findRequisiteSnapshot(db, id, tx);
      return snapshot ? toPublicRequisite(snapshot) : null;
    },
    async findActiveRequisiteById(id, tx) {
      const snapshot = await findActiveRequisiteSnapshot(db, id, tx);
      return snapshot ? toPublicRequisite(snapshot) : null;
    },
    async listRequisites(input, tx) {
      const database = tx ?? db;
      const conditions: SQL[] = [isNull(requisites.archivedAt)];

      if (input.label) {
        conditions.push(ilike(requisites.label, `%${input.label}%`));
      }

      if (input.ownerType) {
        conditions.push(
          eq(requisites.ownerType, input.ownerType as RequisiteOwnerType),
        );
      }

      if (input.ownerId && input.ownerType) {
        conditions.push(
          eq(ownerIdColumn(input.ownerType as RequisiteOwnerType), input.ownerId),
        );
      }

      if (input.currencyId?.length) {
        conditions.push(inArray(requisites.currencyId, input.currencyId));
      }

      if (input.kind?.length) {
        conditions.push(inArray(requisites.kind, input.kind as Requisite["kind"][]));
      }

      if (input.providerId?.length) {
        conditions.push(inArray(requisites.providerId, input.providerId));
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        REQUISITES_SORT_COLUMN_MAP,
        requisites.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        database
          .select()
          .from(requisites)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(requisites)
          .where(where),
      ]);

      return {
        data: rows.map((row) => toPublicRequisite(toSnapshot(row))),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<Requisite>;
    },
    async listRequisiteOptions(input, tx) {
      const database = tx ?? db;
      const conditions: SQL[] = [isNull(requisites.archivedAt)];

      if (input.ownerType) {
        conditions.push(
          eq(requisites.ownerType, input.ownerType as RequisiteOwnerType),
        );
      }

      if (input.ownerId && input.ownerType) {
        conditions.push(
          eq(ownerIdColumn(input.ownerType as RequisiteOwnerType), input.ownerId),
        );
      }

      const rows = await database
        .select({
          id: requisites.id,
          ownerType: requisites.ownerType,
          ownerId: sql<string>`coalesce(${requisites.organizationId}, ${requisites.counterpartyId})`,
          providerId: requisites.providerId,
          currencyId: requisites.currencyId,
          kind: requisites.kind,
          label: requisites.label,
          beneficiaryName: requisites.beneficiaryName,
          institutionName: requisites.institutionName,
          institutionCountry: requisites.institutionCountry,
          accountNo: requisites.accountNo,
          corrAccount: requisites.corrAccount,
          iban: requisites.iban,
          bic: requisites.bic,
          swift: requisites.swift,
          bankAddress: requisites.bankAddress,
          network: requisites.network,
          assetCode: requisites.assetCode,
          address: requisites.address,
          memoTag: requisites.memoTag,
          accountRef: requisites.accountRef,
          subaccountRef: requisites.subaccountRef,
          contact: requisites.contact,
          notes: requisites.notes,
          currencyCode: currencyCodeSql,
        })
        .from(requisites)
        .where(and(...conditions))
        .orderBy(asc(requisites.label), asc(requisites.createdAt));

      return rows satisfies RequisiteOptionRecord[];
    },
    async listLabelsById(ids, tx) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await (tx ?? db)
        .select({
          id: requisites.id,
          label: requisites.label,
        })
        .from(requisites)
        .where(inArray(requisites.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.label]));
    },
    async findSubjectById(requisiteId, tx) {
      const [row] = await this.listSubjectsById([requisiteId], tx);

      return row ?? null;
    },
    async listSubjectsById(requisiteIds, tx) {
      const uniqueIds = Array.from(new Set(requisiteIds.filter(Boolean)));

      if (uniqueIds.length === 0) {
        return [];
      }

      return (tx ?? db)
        .select({
          requisiteId: requisites.id,
          ownerType: requisites.ownerType,
          ownerId: sql<string>`coalesce(${requisites.organizationId}, ${requisites.counterpartyId})`,
          organizationId: requisites.organizationId,
          currencyId: requisites.currencyId,
          currencyCode: currencyCodeSql,
        })
        .from(requisites)
        .where(inArray(requisites.id, uniqueIds));
    },
  };
}

export function createDrizzleRequisitesCommandRepository(
  db: Database,
): RequisitesCommandRepository {
  return {
    async findRequisiteSnapshotById(id, tx) {
      return findRequisiteSnapshot(db, id, tx);
    },
    async findActiveRequisiteSnapshotById(id, tx) {
      return findActiveRequisiteSnapshot(db, id, tx);
    },
    async listActiveRequisitesByOwnerCurrency(input, tx) {
      const database = tx ?? db;
      const rows = await database
        .select()
        .from(requisites)
        .where(
          and(
            eq(requisites.ownerType, input.ownerType),
            eq(ownerIdColumn(input.ownerType), input.ownerId),
            eq(requisites.currencyId, input.currencyId),
            isNull(requisites.archivedAt),
          ),
        )
        .orderBy(asc(requisites.createdAt), asc(requisites.id));

      return rows.map(toSnapshot);
    },
    async insertRequisite(requisite, tx) {
      const [created] = await (tx ?? db)
        .insert(requisites)
        .values({
          id: requisite.id,
          ownerType: requisite.ownerType,
          organizationId:
            requisite.ownerType === "organization" ? requisite.ownerId : null,
          counterpartyId:
            requisite.ownerType === "counterparty" ? requisite.ownerId : null,
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
    async updateRequisite(requisite, tx) {
      const [updated] = await (tx ?? db)
        .update(requisites)
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
        .where(eq(requisites.id, requisite.id))
        .returning();

      return updated ? toSnapshot(updated) : null;
    },
    async setDefaultState(input, tx) {
      const database = tx ?? db;
      const demotedIds = input.demotedIds.filter((id) => id !== input.defaultId);

      if (demotedIds.length > 0) {
        await database
          .update(requisites)
          .set({
            isDefault: false,
            updatedAt: sql`now()`,
          })
          .where(
            and(
              eq(requisites.ownerType, input.ownerType),
              eq(ownerIdColumn(input.ownerType), input.ownerId),
              eq(requisites.currencyId, input.currencyId),
              isNull(requisites.archivedAt),
              inArray(requisites.id, demotedIds),
            ),
          );
      }

      if (input.defaultId) {
        await database
          .update(requisites)
          .set({
            isDefault: true,
            updatedAt: sql`now()`,
          })
          .where(eq(requisites.id, input.defaultId));
      }
    },
    async archiveRequisite(input, tx) {
      const [updated] = await (tx ?? db)
        .update(requisites)
        .set({
          archivedAt: input.archivedAt,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(eq(requisites.id, input.requisiteId))
        .returning({ id: requisites.id });

      return Boolean(updated);
    },
  };
}
