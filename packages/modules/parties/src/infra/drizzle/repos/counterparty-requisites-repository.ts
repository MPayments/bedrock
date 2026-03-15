import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type { CounterpartyRequisite } from "../../../contracts";
import type {
  CounterpartyRequisiteOptionRecord,
  CounterpartyRequisitesRepository,
} from "../../../application/ports";
import { currencies } from "@bedrock/currencies/schema";
import {
  counterpartyRequisites,
  type CounterpartyRequisiteRow,
} from "../schema";

const REQUISITES_SORT_COLUMN_MAP = {
  label: counterpartyRequisites.label,
  kind: counterpartyRequisites.kind,
  createdAt: counterpartyRequisites.createdAt,
  updatedAt: counterpartyRequisites.updatedAt,
} as const;

function resolveDb(db: Queryable, queryable?: Queryable): Queryable {
  return queryable ?? db;
}

function toPublicRequisite(row: CounterpartyRequisiteRow): CounterpartyRequisite {
  return {
    id: row.id,
    ownerType: "counterparty",
    ownerId: row.counterpartyId!,
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

export function createDrizzleCounterpartyRequisitesRepository(
  db: Queryable,
): CounterpartyRequisitesRepository {
  return {
    async findRequisiteById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(counterpartyRequisites)
        .where(
          and(
            eq(counterpartyRequisites.id, id),
            eq(counterpartyRequisites.ownerType, "counterparty"),
          ),
        )
        .limit(1);

      return row ? toPublicRequisite(row) : null;
    },
    async findActiveRequisiteById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(counterpartyRequisites)
        .where(
          and(
            eq(counterpartyRequisites.id, id),
            eq(counterpartyRequisites.ownerType, "counterparty"),
            isNull(counterpartyRequisites.archivedAt),
          ),
        )
        .limit(1);

      return row ? toPublicRequisite(row) : null;
    },
    async listRequisites(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [
        eq(counterpartyRequisites.ownerType, "counterparty"),
        isNull(counterpartyRequisites.archivedAt),
      ];

      if (input.label) {
        conditions.push(ilike(counterpartyRequisites.label, `%${input.label}%`));
      }

      if (input.counterpartyId) {
        conditions.push(eq(counterpartyRequisites.counterpartyId, input.counterpartyId));
      }

      if (input.currencyId?.length) {
        conditions.push(inArray(counterpartyRequisites.currencyId, input.currencyId));
      }

      if (input.kind?.length) {
        conditions.push(
          inArray(counterpartyRequisites.kind, input.kind as CounterpartyRequisite["kind"][]),
        );
      }

      if (input.providerId?.length) {
        conditions.push(inArray(counterpartyRequisites.providerId, input.providerId));
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        REQUISITES_SORT_COLUMN_MAP,
        counterpartyRequisites.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        database
          .select()
          .from(counterpartyRequisites)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(counterpartyRequisites)
          .where(where),
      ]);

      return {
        data: rows.map(toPublicRequisite),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<CounterpartyRequisite>;
    },
    async listRequisiteOptions(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [
        eq(counterpartyRequisites.ownerType, "counterparty"),
        isNull(counterpartyRequisites.archivedAt),
      ];

      if (input.counterpartyId) {
        conditions.push(eq(counterpartyRequisites.counterpartyId, input.counterpartyId));
      }

      const rows = await database
        .select({
          id: counterpartyRequisites.id,
          ownerId: counterpartyRequisites.counterpartyId,
          providerId: counterpartyRequisites.providerId,
          currencyId: counterpartyRequisites.currencyId,
          kind: counterpartyRequisites.kind,
          label: counterpartyRequisites.label,
          beneficiaryName: counterpartyRequisites.beneficiaryName,
          institutionName: counterpartyRequisites.institutionName,
          institutionCountry: counterpartyRequisites.institutionCountry,
          accountNo: counterpartyRequisites.accountNo,
          corrAccount: counterpartyRequisites.corrAccount,
          iban: counterpartyRequisites.iban,
          bic: counterpartyRequisites.bic,
          swift: counterpartyRequisites.swift,
          bankAddress: counterpartyRequisites.bankAddress,
          network: counterpartyRequisites.network,
          assetCode: counterpartyRequisites.assetCode,
          address: counterpartyRequisites.address,
          memoTag: counterpartyRequisites.memoTag,
          accountRef: counterpartyRequisites.accountRef,
          subaccountRef: counterpartyRequisites.subaccountRef,
          contact: counterpartyRequisites.contact,
          notes: counterpartyRequisites.notes,
          currencyCode: currencies.code,
        })
        .from(counterpartyRequisites)
        .innerJoin(currencies, eq(currencies.id, counterpartyRequisites.currencyId))
        .where(and(...conditions))
        .orderBy(asc(counterpartyRequisites.label), asc(counterpartyRequisites.createdAt));

      return rows.map((row) => ({
        id: row.id,
        ownerType: "counterparty",
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
      })) satisfies CounterpartyRequisiteOptionRecord[];
    },
    async listLabelsById(ids, queryable) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await resolveDb(db, queryable)
        .select({
          id: counterpartyRequisites.id,
          label: counterpartyRequisites.label,
        })
        .from(counterpartyRequisites)
        .where(
          and(
            eq(counterpartyRequisites.ownerType, "counterparty"),
            inArray(counterpartyRequisites.id, uniqueIds),
          ),
        );

      return new Map(rows.map((row) => [row.id, row.label]));
    },
    async countActiveRequisitesByCounterpartyCurrency(input, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select({ total: sql<number>`count(*)::int` })
        .from(counterpartyRequisites)
        .where(
          and(
            eq(counterpartyRequisites.ownerType, "counterparty"),
            eq(counterpartyRequisites.counterpartyId, input.counterpartyId),
            eq(counterpartyRequisites.currencyId, input.currencyId),
            isNull(counterpartyRequisites.archivedAt),
          ),
        );

      return row?.total ?? 0;
    },
    async clearOtherDefaultsTx(tx, input) {
      await tx
        .update(counterpartyRequisites)
        .set({ isDefault: false })
        .where(
          and(
            eq(counterpartyRequisites.ownerType, "counterparty"),
            eq(counterpartyRequisites.counterpartyId, input.counterpartyId),
            eq(counterpartyRequisites.currencyId, input.currencyId),
            isNull(counterpartyRequisites.archivedAt),
            ne(counterpartyRequisites.id, input.currentId),
          ),
        );

      await tx
        .update(counterpartyRequisites)
        .set({ isDefault: true })
        .where(eq(counterpartyRequisites.id, input.currentId));
    },
    async promoteNextDefaultTx(tx, input) {
      const [replacement] = await tx
        .select({ id: counterpartyRequisites.id })
        .from(counterpartyRequisites)
        .where(
          and(
            eq(counterpartyRequisites.ownerType, "counterparty"),
            eq(counterpartyRequisites.counterpartyId, input.counterpartyId),
            eq(counterpartyRequisites.currencyId, input.currencyId),
            isNull(counterpartyRequisites.archivedAt),
            ne(counterpartyRequisites.id, input.excludeId),
          ),
        )
        .limit(1);

      if (!replacement) {
        return;
      }

      await tx
        .update(counterpartyRequisites)
        .set({ isDefault: true, updatedAt: sql`now()` })
        .where(eq(counterpartyRequisites.id, replacement.id));
    },
    async insertRequisiteTx(tx, input) {
      const [created] = await tx
        .insert(counterpartyRequisites)
        .values({
          ownerType: "counterparty",
          organizationId: null,
          counterpartyId: input.counterpartyId,
          providerId: input.providerId,
          currencyId: input.currencyId,
          kind: input.kind,
          label: input.label,
          description: input.description ?? null,
          beneficiaryName: input.beneficiaryName ?? null,
          institutionName: input.institutionName ?? null,
          institutionCountry: input.institutionCountry ?? null,
          accountNo: input.accountNo ?? null,
          corrAccount: input.corrAccount ?? null,
          iban: input.iban ?? null,
          bic: input.bic ?? null,
          swift: input.swift ?? null,
          bankAddress: input.bankAddress ?? null,
          network: input.network ?? null,
          assetCode: input.assetCode ?? null,
          address: input.address ?? null,
          memoTag: input.memoTag ?? null,
          accountRef: input.accountRef ?? null,
          subaccountRef: input.subaccountRef ?? null,
          contact: input.contact ?? null,
          notes: input.notes ?? null,
          isDefault: input.isDefault,
        })
        .returning();

      return toPublicRequisite(created!);
    },
    async updateRequisiteTx(tx, id, input) {
      const [updated] = await tx
        .update(counterpartyRequisites)
        .set({
          providerId: input.providerId,
          currencyId: input.currencyId,
          kind: input.kind,
          label: input.label,
          description: input.description !== undefined ? (input.description ?? null) : undefined,
          beneficiaryName:
            input.beneficiaryName !== undefined ? (input.beneficiaryName ?? null) : undefined,
          institutionName:
            input.institutionName !== undefined ? (input.institutionName ?? null) : undefined,
          institutionCountry:
            input.institutionCountry !== undefined
              ? (input.institutionCountry ?? null)
              : undefined,
          accountNo: input.accountNo !== undefined ? (input.accountNo ?? null) : undefined,
          corrAccount:
            input.corrAccount !== undefined ? (input.corrAccount ?? null) : undefined,
          iban: input.iban !== undefined ? (input.iban ?? null) : undefined,
          bic: input.bic !== undefined ? (input.bic ?? null) : undefined,
          swift: input.swift !== undefined ? (input.swift ?? null) : undefined,
          bankAddress:
            input.bankAddress !== undefined ? (input.bankAddress ?? null) : undefined,
          network: input.network !== undefined ? (input.network ?? null) : undefined,
          assetCode: input.assetCode !== undefined ? (input.assetCode ?? null) : undefined,
          address: input.address !== undefined ? (input.address ?? null) : undefined,
          memoTag: input.memoTag !== undefined ? (input.memoTag ?? null) : undefined,
          accountRef: input.accountRef !== undefined ? (input.accountRef ?? null) : undefined,
          subaccountRef:
            input.subaccountRef !== undefined ? (input.subaccountRef ?? null) : undefined,
          contact: input.contact !== undefined ? (input.contact ?? null) : undefined,
          notes: input.notes !== undefined ? (input.notes ?? null) : undefined,
          isDefault: input.isDefault,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(counterpartyRequisites.id, id),
            eq(counterpartyRequisites.ownerType, "counterparty"),
          ),
        )
        .returning();

      return updated ? toPublicRequisite(updated) : null;
    },
    async archiveRequisiteTx(tx, id) {
      const [updated] = await tx
        .update(counterpartyRequisites)
        .set({
          archivedAt: sql`now()`,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(counterpartyRequisites.id, id),
            eq(counterpartyRequisites.ownerType, "counterparty"),
          ),
        )
        .returning({ id: counterpartyRequisites.id });

      return Boolean(updated);
    },
  };
}
