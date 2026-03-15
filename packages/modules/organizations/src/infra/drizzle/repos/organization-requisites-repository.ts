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

import type {
  OrganizationRequisite,
  OrganizationRequisiteAccountingBinding,
} from "../../../contracts";
import type {
  OrganizationRequisiteOptionRecord,
  OrganizationsRequisiteBindingResolution,
  OrganizationRequisitesRepository,
} from "../../../application/ports";
import {
  organizationRequisiteBindings,
  organizationRequisites,
  type OrganizationRequisiteRow,
} from "../schema";
import { currencies } from "@bedrock/currencies/schema";

const REQUISITES_SORT_COLUMN_MAP = {
  label: organizationRequisites.label,
  kind: organizationRequisites.kind,
  createdAt: organizationRequisites.createdAt,
  updatedAt: organizationRequisites.updatedAt,
} as const;

function resolveDb(db: Queryable, queryable?: Queryable): Queryable {
  return queryable ?? db;
}

function toPublicRequisite(
  row: OrganizationRequisiteRow,
): OrganizationRequisite {
  return {
    id: row.id,
    ownerType: "organization",
    ownerId: row.organizationId!,
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

export function createDrizzleOrganizationRequisitesRepository(
  db: Queryable,
): OrganizationRequisitesRepository {
  return {
    async findRequisiteById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(organizationRequisites)
        .where(
          and(
            eq(organizationRequisites.id, id),
            eq(organizationRequisites.ownerType, "organization"),
          ),
        )
        .limit(1);

      return row ? toPublicRequisite(row) : null;
    },
    async findActiveRequisiteById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
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

      return row ? toPublicRequisite(row) : null;
    },
    async listRequisites(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [
        eq(organizationRequisites.ownerType, "organization"),
        isNull(organizationRequisites.archivedAt),
      ];

      if (input.label) {
        conditions.push(
          ilike(organizationRequisites.label, `%${input.label}%`),
        );
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
        database
          .select()
          .from(organizationRequisites)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(organizationRequisites)
          .where(where),
      ]);

      return {
        data: rows.map(toPublicRequisite),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<OrganizationRequisite>;
    },
    async listRequisiteOptions(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [
        eq(organizationRequisites.ownerType, "organization"),
        isNull(organizationRequisites.archivedAt),
      ];

      if (input.organizationId) {
        conditions.push(
          eq(organizationRequisites.organizationId, input.organizationId),
        );
      }

      const rows = await database
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
        ownerType: "organization",
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
    async listLabelsById(ids, queryable) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await resolveDb(db, queryable)
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
    async countActiveRequisitesByOrganizationCurrency(input, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select({ total: sql<number>`count(*)::int` })
        .from(organizationRequisites)
        .where(
          and(
            eq(organizationRequisites.ownerType, "organization"),
            eq(organizationRequisites.organizationId, input.organizationId),
            eq(organizationRequisites.currencyId, input.currencyId),
            isNull(organizationRequisites.archivedAt),
          ),
        );

      return row?.total ?? 0;
    },
    async clearOtherDefaultsTx(tx, input) {
      await tx
        .update(organizationRequisites)
        .set({ isDefault: false })
        .where(
          and(
            eq(organizationRequisites.ownerType, "organization"),
            eq(organizationRequisites.organizationId, input.organizationId),
            eq(organizationRequisites.currencyId, input.currencyId),
            isNull(organizationRequisites.archivedAt),
            ne(organizationRequisites.id, input.currentId),
          ),
        );

      await tx
        .update(organizationRequisites)
        .set({ isDefault: true })
        .where(eq(organizationRequisites.id, input.currentId));
    },
    async promoteNextDefaultTx(tx, input) {
      const [replacement] = await tx
        .select({ id: organizationRequisites.id })
        .from(organizationRequisites)
        .where(
          and(
            eq(organizationRequisites.ownerType, "organization"),
            eq(organizationRequisites.organizationId, input.organizationId),
            eq(organizationRequisites.currencyId, input.currencyId),
            isNull(organizationRequisites.archivedAt),
            ne(organizationRequisites.id, input.excludeId),
          ),
        )
        .limit(1);

      if (!replacement) {
        return;
      }

      await tx
        .update(organizationRequisites)
        .set({ isDefault: true, updatedAt: sql`now()` })
        .where(eq(organizationRequisites.id, replacement.id));
    },
    async insertRequisiteTx(tx, input) {
      const [created] = await tx
        .insert(organizationRequisites)
        .values({
          ownerType: "organization",
          organizationId: input.organizationId,
          counterpartyId: null,
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
        .update(organizationRequisites)
        .set({
          providerId: input.providerId,
          currencyId: input.currencyId,
          kind: input.kind,
          label: input.label,
          description:
            input.description !== undefined
              ? (input.description ?? null)
              : undefined,
          beneficiaryName:
            input.beneficiaryName !== undefined
              ? (input.beneficiaryName ?? null)
              : undefined,
          institutionName:
            input.institutionName !== undefined
              ? (input.institutionName ?? null)
              : undefined,
          institutionCountry:
            input.institutionCountry !== undefined
              ? (input.institutionCountry ?? null)
              : undefined,
          accountNo:
            input.accountNo !== undefined
              ? (input.accountNo ?? null)
              : undefined,
          corrAccount:
            input.corrAccount !== undefined
              ? (input.corrAccount ?? null)
              : undefined,
          iban: input.iban !== undefined ? (input.iban ?? null) : undefined,
          bic: input.bic !== undefined ? (input.bic ?? null) : undefined,
          swift: input.swift !== undefined ? (input.swift ?? null) : undefined,
          bankAddress:
            input.bankAddress !== undefined
              ? (input.bankAddress ?? null)
              : undefined,
          network:
            input.network !== undefined ? (input.network ?? null) : undefined,
          assetCode:
            input.assetCode !== undefined
              ? (input.assetCode ?? null)
              : undefined,
          address:
            input.address !== undefined ? (input.address ?? null) : undefined,
          memoTag:
            input.memoTag !== undefined ? (input.memoTag ?? null) : undefined,
          accountRef:
            input.accountRef !== undefined
              ? (input.accountRef ?? null)
              : undefined,
          subaccountRef:
            input.subaccountRef !== undefined
              ? (input.subaccountRef ?? null)
              : undefined,
          contact:
            input.contact !== undefined ? (input.contact ?? null) : undefined,
          notes: input.notes !== undefined ? (input.notes ?? null) : undefined,
          isDefault: input.isDefault,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(organizationRequisites.id, id),
            eq(organizationRequisites.ownerType, "organization"),
          ),
        )
        .returning();

      return updated ? toPublicRequisite(updated) : null;
    },
    async archiveRequisiteTx(tx, id) {
      const [updated] = await tx
        .update(organizationRequisites)
        .set({
          archivedAt: sql`now()`,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(organizationRequisites.id, id),
            eq(organizationRequisites.ownerType, "organization"),
          ),
        )
        .returning({ id: organizationRequisites.id });

      return Boolean(updated);
    },
    async findBindingByRequisiteId(requisiteId, queryable) {
      const [binding] = await resolveDb(db, queryable)
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
      } satisfies OrganizationRequisiteAccountingBinding;
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

      return this.findBindingByRequisiteId(input.requisiteId, tx);
    },
    async listResolvedBindingsById(requisiteIds, queryable) {
      const uniqueIds = Array.from(new Set(requisiteIds.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return [];
      }

      const rows = await resolveDb(db, queryable)
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
