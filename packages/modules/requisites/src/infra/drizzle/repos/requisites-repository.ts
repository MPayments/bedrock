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
  Requisite,
  RequisiteAccountingBinding,
  RequisiteOwnerType,
  RequisiteProvider,
} from "../../../contracts";
import type {
  RequisiteBindingResolution,
  RequisiteOptionRecord,
  RequisitesRepository,
} from "../../../application/ports";
import { schema, type RequisiteRow } from "../schema";

const REQUISITES_SORT_COLUMN_MAP = {
  label: schema.requisites.label,
  kind: schema.requisites.kind,
  createdAt: schema.requisites.createdAt,
  updatedAt: schema.requisites.updatedAt,
} as const;

const PROVIDERS_SORT_COLUMN_MAP = {
  name: schema.requisiteProviders.name,
  kind: schema.requisiteProviders.kind,
  country: schema.requisiteProviders.country,
  createdAt: schema.requisiteProviders.createdAt,
  updatedAt: schema.requisiteProviders.updatedAt,
} as const;

function resolveDb(db: Queryable, queryable?: Queryable): Queryable {
  return queryable ?? db;
}

function toPublicRequisite(row: RequisiteRow): Requisite {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId:
      row.ownerType === "organization"
        ? row.organizationId!
        : row.counterpartyId!,
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

export function createDrizzleRequisitesRepository(
  db: Queryable,
): RequisitesRepository {
  return {
    async findRequisiteById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(schema.requisites)
        .where(eq(schema.requisites.id, id))
        .limit(1);

      return row ? toPublicRequisite(row) : null;
    },
    async findActiveRequisiteById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(schema.requisites)
        .where(
          and(
            eq(schema.requisites.id, id),
            isNull(schema.requisites.archivedAt),
          ),
        )
        .limit(1);

      return row ? toPublicRequisite(row) : null;
    },
    async listRequisites(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [isNull(schema.requisites.archivedAt)];

      if (input.label) {
        conditions.push(ilike(schema.requisites.label, `%${input.label}%`));
      }

      if (input.ownerType?.length) {
        conditions.push(
          eq(
            schema.requisites.ownerType,
            input.ownerType as RequisiteOwnerType,
          ),
        );
      }

      if (input.ownerId && input.ownerType === "organization") {
        conditions.push(eq(schema.requisites.organizationId, input.ownerId));
      }

      if (input.ownerId && input.ownerType === "counterparty") {
        conditions.push(eq(schema.requisites.counterpartyId, input.ownerId));
      }

      if (input.currencyId?.length) {
        conditions.push(
          inArray(schema.requisites.currencyId, input.currencyId),
        );
      }

      if (input.kind?.length) {
        conditions.push(
          inArray(schema.requisites.kind, input.kind as Requisite["kind"][]),
        );
      }

      if (input.providerId?.length) {
        conditions.push(
          inArray(schema.requisites.providerId, input.providerId),
        );
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        REQUISITES_SORT_COLUMN_MAP,
        schema.requisites.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        database
          .select()
          .from(schema.requisites)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(schema.requisites)
          .where(where),
      ]);

      return {
        data: rows.map(toPublicRequisite),
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<Requisite>;
    },
    async listRequisiteOptions(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [isNull(schema.requisites.archivedAt)];

      if (input.ownerType === "organization" && input.ownerId) {
        conditions.push(eq(schema.requisites.organizationId, input.ownerId));
      }

      if (input.ownerType === "counterparty" && input.ownerId) {
        conditions.push(eq(schema.requisites.counterpartyId, input.ownerId));
      }

      if (input.ownerType) {
        conditions.push(eq(schema.requisites.ownerType, input.ownerType));
      }

      const rows = await database
        .select({
          id: schema.requisites.id,
          ownerType: schema.requisites.ownerType,
          organizationId: schema.requisites.organizationId,
          counterpartyId: schema.requisites.counterpartyId,
          providerId: schema.requisites.providerId,
          currencyId: schema.requisites.currencyId,
          kind: schema.requisites.kind,
          label: schema.requisites.label,
          beneficiaryName: schema.requisites.beneficiaryName,
          institutionName: schema.requisites.institutionName,
          institutionCountry: schema.requisites.institutionCountry,
          accountNo: schema.requisites.accountNo,
          corrAccount: schema.requisites.corrAccount,
          iban: schema.requisites.iban,
          bic: schema.requisites.bic,
          swift: schema.requisites.swift,
          bankAddress: schema.requisites.bankAddress,
          network: schema.requisites.network,
          assetCode: schema.requisites.assetCode,
          address: schema.requisites.address,
          memoTag: schema.requisites.memoTag,
          accountRef: schema.requisites.accountRef,
          subaccountRef: schema.requisites.subaccountRef,
          contact: schema.requisites.contact,
          notes: schema.requisites.notes,
          currencyCode: schema.currencies.code,
        })
        .from(schema.requisites)
        .innerJoin(
          schema.currencies,
          eq(schema.currencies.id, schema.requisites.currencyId),
        )
        .where(and(...conditions))
        .orderBy(
          asc(schema.requisites.label),
          asc(schema.requisites.createdAt),
        );

      return rows.map((row) => ({
        id: row.id,
        ownerType: row.ownerType,
        ownerId:
          row.ownerType === "organization"
            ? row.organizationId!
            : row.counterpartyId!,
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
      })) satisfies RequisiteOptionRecord[];
    },
    async listRequisitesById(ids, queryable) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return [];
      }

      return resolveDb(db, queryable)
        .select({
          id: schema.requisites.id,
          ownerType: schema.requisites.ownerType,
          organizationId: schema.requisites.organizationId,
          counterpartyId: schema.requisites.counterpartyId,
          label: schema.requisites.label,
        })
        .from(schema.requisites)
        .where(inArray(schema.requisites.id, uniqueIds));
    },
    async listLabelsById(ids, queryable) {
      const rows = await this.listRequisitesById(ids, queryable);
      return new Map(rows.map((row) => [row.id, row.label]));
    },
    async countActiveRequisitesByOwnerCurrency(input, queryable) {
      const database = resolveDb(db, queryable);
      const [row] = await database
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.requisites)
        .where(
          and(
            eq(schema.requisites.ownerType, input.ownerType),
            input.ownerType === "organization"
              ? eq(schema.requisites.organizationId, input.ownerId)
              : eq(schema.requisites.counterpartyId, input.ownerId),
            eq(schema.requisites.currencyId, input.currencyId),
            isNull(schema.requisites.archivedAt),
          ),
        );

      return row?.total ?? 0;
    },
    async clearOtherDefaultsTx(tx, input) {
      await tx
        .update(schema.requisites)
        .set({ isDefault: false })
        .where(
          and(
            eq(schema.requisites.ownerType, input.ownerType),
            input.ownerType === "organization"
              ? eq(schema.requisites.organizationId, input.ownerId)
              : eq(schema.requisites.counterpartyId, input.ownerId),
            eq(schema.requisites.currencyId, input.currencyId),
            isNull(schema.requisites.archivedAt),
            ne(schema.requisites.id, input.currentId),
          ),
        );

      await tx
        .update(schema.requisites)
        .set({ isDefault: true })
        .where(eq(schema.requisites.id, input.currentId));
    },
    async promoteNextDefaultTx(tx, input) {
      const [replacement] = await tx
        .select({ id: schema.requisites.id })
        .from(schema.requisites)
        .where(
          and(
            eq(schema.requisites.ownerType, input.ownerType),
            input.ownerType === "organization"
              ? eq(schema.requisites.organizationId, input.ownerId)
              : eq(schema.requisites.counterpartyId, input.ownerId),
            eq(schema.requisites.currencyId, input.currencyId),
            isNull(schema.requisites.archivedAt),
            ne(schema.requisites.id, input.excludeId),
          ),
        )
        .limit(1);

      if (!replacement) {
        return;
      }

      await tx
        .update(schema.requisites)
        .set({ isDefault: true, updatedAt: sql`now()` })
        .where(eq(schema.requisites.id, replacement.id));
    },
    async insertRequisiteTx(tx, input) {
      const [created] = await tx
        .insert(schema.requisites)
        .values({
          ownerType: input.ownerType,
          organizationId:
            input.ownerType === "organization" ? input.ownerId : null,
          counterpartyId:
            input.ownerType === "counterparty" ? input.ownerId : null,
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
        .update(schema.requisites)
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
        .where(eq(schema.requisites.id, id))
        .returning();

      return updated ? toPublicRequisite(updated) : null;
    },
    async archiveRequisiteTx(tx, id) {
      const [updated] = await tx
        .update(schema.requisites)
        .set({
          archivedAt: sql`now()`,
          isDefault: false,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.requisites.id, id))
        .returning({ id: schema.requisites.id });

      return Boolean(updated);
    },

    async findProviderById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(schema.requisiteProviders)
        .where(eq(schema.requisiteProviders.id, id))
        .limit(1);

      return row ?? null;
    },
    async findActiveProviderById(id, queryable) {
      const [row] = await resolveDb(db, queryable)
        .select()
        .from(schema.requisiteProviders)
        .where(
          and(
            eq(schema.requisiteProviders.id, id),
            isNull(schema.requisiteProviders.archivedAt),
          ),
        )
        .limit(1);

      return row ?? null;
    },
    async listProviders(input, queryable) {
      const database = resolveDb(db, queryable);
      const conditions: SQL[] = [isNull(schema.requisiteProviders.archivedAt)];

      if (input.name) {
        conditions.push(
          ilike(schema.requisiteProviders.name, `%${input.name}%`),
        );
      }

      if (input.kind?.length) {
        conditions.push(
          inArray(
            schema.requisiteProviders.kind,
            input.kind as RequisiteProvider["kind"][],
          ),
        );
      }

      if (input.country?.length) {
        conditions.push(
          inArray(schema.requisiteProviders.country, input.country),
        );
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        input.sortBy,
        PROVIDERS_SORT_COLUMN_MAP,
        schema.requisiteProviders.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        database
          .select()
          .from(schema.requisiteProviders)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(input.limit)
          .offset(input.offset),
        database
          .select({ total: sql<number>`count(*)::int` })
          .from(schema.requisiteProviders)
          .where(where),
      ]);

      return {
        data: rows,
        total: countRows[0]?.total ?? 0,
        limit: input.limit,
        offset: input.offset,
      } satisfies PaginatedList<RequisiteProvider>;
    },
    async insertProvider(input, queryable) {
      const [created] = await resolveDb(db, queryable)
        .insert(schema.requisiteProviders)
        .values({
          kind: input.kind,
          name: input.name,
          description: input.description ?? null,
          country: input.country ?? null,
          address: input.address ?? null,
          contact: input.contact ?? null,
          bic: input.bic ?? null,
          swift: input.swift ?? null,
        })
        .returning();

      return created!;
    },
    async updateProvider(id, input, queryable) {
      const fields: Record<string, unknown> = {};
      if (input.kind !== undefined) fields.kind = input.kind;
      if (input.name !== undefined) fields.name = input.name;
      if (input.description !== undefined)
        fields.description = input.description;
      if (input.country !== undefined) fields.country = input.country;
      if (input.address !== undefined) fields.address = input.address;
      if (input.contact !== undefined) fields.contact = input.contact;
      if (input.bic !== undefined) fields.bic = input.bic;
      if (input.swift !== undefined) fields.swift = input.swift;

      if (Object.keys(fields).length === 0) {
        return this.findActiveProviderById(id, queryable);
      }

      fields.updatedAt = sql`now()`;

      const [updated] = await resolveDb(db, queryable)
        .update(schema.requisiteProviders)
        .set(fields)
        .where(eq(schema.requisiteProviders.id, id))
        .returning();

      return updated ?? null;
    },
    async archiveProvider(id, queryable) {
      const [updated] = await resolveDb(db, queryable)
        .update(schema.requisiteProviders)
        .set({
          archivedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(schema.requisiteProviders.id, id))
        .returning({ id: schema.requisiteProviders.id });

      return Boolean(updated);
    },

    async findBindingByRequisiteId(requisiteId, queryable) {
      const [binding] = await resolveDb(db, queryable)
        .select({
          requisiteId: schema.requisiteAccountingBindings.requisiteId,
          organizationId: schema.requisites.organizationId,
          bookId: schema.requisiteAccountingBindings.bookId,
          bookAccountInstanceId:
            schema.requisiteAccountingBindings.bookAccountInstanceId,
          postingAccountNo: schema.requisiteAccountingBindings.postingAccountNo,
          createdAt: schema.requisiteAccountingBindings.createdAt,
          updatedAt: schema.requisiteAccountingBindings.updatedAt,
        })
        .from(schema.requisiteAccountingBindings)
        .innerJoin(
          schema.requisites,
          eq(
            schema.requisiteAccountingBindings.requisiteId,
            schema.requisites.id,
          ),
        )
        .where(eq(schema.requisiteAccountingBindings.requisiteId, requisiteId))
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
      } satisfies RequisiteAccountingBinding;
    },
    async upsertBindingTx(tx, input) {
      await tx
        .insert(schema.requisiteAccountingBindings)
        .values({
          requisiteId: input.requisiteId,
          bookId: input.bookId,
          bookAccountInstanceId: input.bookAccountInstanceId,
          postingAccountNo: input.postingAccountNo,
        })
        .onConflictDoUpdate({
          target: schema.requisiteAccountingBindings.requisiteId,
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

      return resolveDb(db, queryable)
        .select({
          requisiteId: schema.requisites.id,
          organizationId: schema.requisites.organizationId,
          bookId: schema.requisiteAccountingBindings.bookId,
          bookAccountInstanceId:
            schema.requisiteAccountingBindings.bookAccountInstanceId,
          currencyId: schema.requisites.currencyId,
          currencyCode: schema.currencies.code,
          postingAccountNo: schema.requisiteAccountingBindings.postingAccountNo,
        })
        .from(schema.requisites)
        .innerJoin(
          schema.requisiteAccountingBindings,
          eq(
            schema.requisiteAccountingBindings.requisiteId,
            schema.requisites.id,
          ),
        )
        .innerJoin(
          schema.currencies,
          eq(schema.currencies.id, schema.requisites.currencyId),
        )
        .where(inArray(schema.requisites.id, uniqueIds))
        .then(
          (rows) =>
            rows
              .filter((row) => Boolean(row.organizationId))
              .map((row) => ({
                requisiteId: row.requisiteId,
                organizationId: row.organizationId!,
                bookId: row.bookId,
                bookAccountInstanceId: row.bookAccountInstanceId,
                currencyId: row.currencyId,
                currencyCode: row.currencyCode,
                postingAccountNo: row.postingAccountNo,
              })) satisfies RequisiteBindingResolution[],
        );
    },
  };
}
