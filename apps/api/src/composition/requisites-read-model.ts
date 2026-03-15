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

import { organizationRequisites } from "@bedrock/organizations/schema";
import { currencies } from "@bedrock/currencies/schema";
import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";
import { buildRequisiteDisplayLabel } from "@bedrock/shared/requisites";

import type {
  ListRequisiteOptionsQuery,
  ListRequisitesQuery,
  Requisite,
  RequisiteOption,
} from "../routes/contracts/requisites";

const REQUISITES_SORT_COLUMN_MAP = {
  label: organizationRequisites.label,
  kind: organizationRequisites.kind,
  createdAt: organizationRequisites.createdAt,
  updatedAt: organizationRequisites.updatedAt,
} as const;

type RequisiteRow = typeof organizationRequisites.$inferSelect;

function toPublicRequisite(row: RequisiteRow): Requisite {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId:
      row.ownerType === "organization" ? row.organizationId! : row.counterpartyId!,
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

export interface ApiRequisitesReadModel {
  findById: (id: string) => Promise<Requisite | null>;
  list: (input: ListRequisitesQuery) => Promise<PaginatedList<Requisite>>;
  listOptions: (input: ListRequisiteOptionsQuery) => Promise<RequisiteOption[]>;
}

export function createApiRequisitesReadModel(input: {
  db: Queryable;
}): ApiRequisitesReadModel {
  const { db } = input;

  return {
    async findById(id) {
      const [row] = await db
        .select()
        .from(organizationRequisites)
        .where(
          and(
            eq(organizationRequisites.id, id),
            isNull(organizationRequisites.archivedAt),
          ),
        )
        .limit(1);

      return row ? toPublicRequisite(row) : null;
    },
    async list(inputQuery) {
      const conditions: SQL[] = [isNull(organizationRequisites.archivedAt)];

      if (inputQuery.label) {
        conditions.push(ilike(organizationRequisites.label, `%${inputQuery.label}%`));
      }

      if (inputQuery.ownerType) {
        conditions.push(
          eq(
            organizationRequisites.ownerType,
            inputQuery.ownerType as Requisite["ownerType"],
          ),
        );
      }

      if (inputQuery.ownerId && inputQuery.ownerType === "organization") {
        conditions.push(eq(organizationRequisites.organizationId, inputQuery.ownerId));
      }

      if (inputQuery.ownerId && inputQuery.ownerType === "counterparty") {
        conditions.push(eq(organizationRequisites.counterpartyId, inputQuery.ownerId));
      }

      if (inputQuery.currencyId?.length) {
        conditions.push(inArray(organizationRequisites.currencyId, inputQuery.currencyId));
      }

      if (inputQuery.kind?.length) {
        conditions.push(
          inArray(organizationRequisites.kind, inputQuery.kind as Requisite["kind"][]),
        );
      }

      if (inputQuery.providerId?.length) {
        conditions.push(inArray(organizationRequisites.providerId, inputQuery.providerId));
      }

      const where = and(...conditions);
      const orderByFn =
        resolveSortOrder(inputQuery.sortOrder) === "desc" ? desc : asc;
      const orderByCol = resolveSortValue(
        inputQuery.sortBy,
        REQUISITES_SORT_COLUMN_MAP,
        organizationRequisites.createdAt,
      );

      const [rows, countRows] = await Promise.all([
        db
          .select()
          .from(organizationRequisites)
          .where(where)
          .orderBy(orderByFn(orderByCol))
          .limit(inputQuery.limit)
          .offset(inputQuery.offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(organizationRequisites)
          .where(where),
      ]);

      return {
        data: rows.map(toPublicRequisite),
        total: countRows[0]?.total ?? 0,
        limit: inputQuery.limit,
        offset: inputQuery.offset,
      } satisfies PaginatedList<Requisite>;
    },
    async listOptions(inputQuery) {
      const conditions: SQL[] = [isNull(organizationRequisites.archivedAt)];

      if (inputQuery.ownerType === "organization" && inputQuery.ownerId) {
        conditions.push(eq(organizationRequisites.organizationId, inputQuery.ownerId));
      }

      if (inputQuery.ownerType === "counterparty" && inputQuery.ownerId) {
        conditions.push(eq(organizationRequisites.counterpartyId, inputQuery.ownerId));
      }

      if (inputQuery.ownerType) {
        conditions.push(
          eq(
            organizationRequisites.ownerType,
            inputQuery.ownerType as Requisite["ownerType"],
          ),
        );
      }

      const rows = await db
        .select({
          id: organizationRequisites.id,
          ownerType: organizationRequisites.ownerType,
          organizationId: organizationRequisites.organizationId,
          counterpartyId: organizationRequisites.counterpartyId,
          currencyId: organizationRequisites.currencyId,
          providerId: organizationRequisites.providerId,
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
        .innerJoin(currencies, eq(currencies.id, organizationRequisites.currencyId))
        .where(and(...conditions))
        .orderBy(asc(organizationRequisites.label), asc(organizationRequisites.createdAt));

      return rows.map((row) => ({
        id: row.id,
        ownerType: row.ownerType,
        ownerId:
          row.ownerType === "organization" ? row.organizationId! : row.counterpartyId!,
        currencyId: row.currencyId,
        providerId: row.providerId,
        kind: row.kind,
        label: buildRequisiteDisplayLabel({
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
        }),
      })) satisfies RequisiteOption[];
    },
  };
}
