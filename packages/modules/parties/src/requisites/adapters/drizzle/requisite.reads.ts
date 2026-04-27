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

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  requisiteIdentifiers,
  requisites,
  type RequisiteIdentifierRow,
  type RequisiteRow,
} from "./schema";
import type {
  Requisite,
  RequisiteListItem,
} from "../../application/contracts/requisites";
import type {
  RequisiteOptionRecord,
  RequisiteReads,
} from "../../application/ports/requisite.reads";
import type { RequisiteOwnerType } from "../../domain/owner";
import type { RequisiteSnapshot } from "../../domain/requisite";

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

function mapRowToSnapshot(row: RequisiteRow): RequisiteSnapshot {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId:
      row.ownerType === "organization"
        ? row.organizationId!
        : row.counterpartyId!,
    providerId: row.providerId,
    providerBranchId: row.providerBranchId,
    currencyId: row.currencyId,
    kind: row.kind,
    label: row.label,
    beneficiaryName: row.beneficiaryName,
    beneficiaryNameLocal: row.beneficiaryNameLocal,
    beneficiaryAddress: row.beneficiaryAddress,
    paymentPurposeTemplate: row.paymentPurposeTemplate,
    notes: row.notes,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
  };
}

function mapRowToListItem(row: RequisiteRow): RequisiteListItem {
  const ownerId =
    row.ownerType === "organization" ? row.organizationId! : row.counterpartyId!;

  return {
    ...mapRowToSnapshot(row),
    ownerId,
    organizationId: row.organizationId,
    counterpartyId: row.counterpartyId,
  };
}

function mapRowsToDetail(
  row: RequisiteRow,
  identifierRows: RequisiteIdentifierRow[],
): Requisite {
  return {
    ...mapRowToListItem(row),
    identifiers: identifierRows,
  };
}

function ownerIdColumn(ownerType: RequisiteOwnerType) {
  return ownerType === "organization"
    ? requisites.organizationId
    : requisites.counterpartyId;
}

function findIdentifierValue(
  rows: RequisiteIdentifierRow[],
  scheme: string,
): string | null {
  return (
    rows.find((row) => row.scheme === scheme && row.isPrimary)?.value ??
    rows.find((row) => row.scheme === scheme)?.value ??
    null
  );
}

export class DrizzleRequisiteReads implements RequisiteReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Requisite | null> {
    const [row] = await this.db
      .select()
      .from(requisites)
      .where(eq(requisites.id, id))
      .limit(1);

    if (!row) return null;

    const identifiers = await this.listIdentifierRows([row.id]);
    return mapRowsToDetail(row, identifiers.get(row.id) ?? []);
  }

  async findActiveById(id: string): Promise<Requisite | null> {
    const [row] = await this.db
      .select()
      .from(requisites)
      .where(and(eq(requisites.id, id), isNull(requisites.archivedAt)))
      .limit(1);

    if (!row) return null;

    const identifiers = await this.listIdentifierRows([row.id]);
    return mapRowsToDetail(row, identifiers.get(row.id) ?? []);
  }

  async listActiveBankByCounterpartyId(
    counterpartyId: string,
  ): Promise<RequisiteListItem[]> {
    const rows = await this.db
      .select()
      .from(requisites)
      .where(
        and(
          eq(requisites.ownerType, "counterparty"),
          eq(requisites.counterpartyId, counterpartyId),
          eq(requisites.kind, "bank"),
          isNull(requisites.archivedAt),
        ),
      )
      .orderBy(desc(requisites.createdAt));

    return rows.map((row) => mapRowToListItem(row));
  }

  async list(input: {
    limit: number;
    offset: number;
    sortBy?: "label" | "kind" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
    label?: string;
    ownerType?: string;
    ownerId?: string;
    currencyId?: string[];
    kind?: string[];
    providerId?: string[];
  }): Promise<PaginatedList<RequisiteListItem>> {
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
      conditions.push(
        inArray(requisites.kind, input.kind as RequisiteListItem["kind"][]),
      );
    }

    if (input.providerId?.length) {
      conditions.push(inArray(requisites.providerId, input.providerId));
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      input.sortBy,
      REQUISITES_SORT_COLUMN_MAP,
      requisites.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(requisites)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(requisites)
        .where(where),
    ]);

    return {
      data: rows.map((row) => mapRowToListItem(row)),
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async listOptions(input: {
    ownerType?: "organization" | "counterparty";
    ownerId?: string;
  }): Promise<RequisiteOptionRecord[]> {
    const conditions: SQL[] = [isNull(requisites.archivedAt)];

    if (input.ownerType) {
      conditions.push(eq(requisites.ownerType, input.ownerType));
    }

    if (input.ownerId && input.ownerType) {
      conditions.push(eq(ownerIdColumn(input.ownerType), input.ownerId));
    }

    const rows = await this.db
      .select({
        id: requisites.id,
        ownerType: requisites.ownerType,
        ownerId: sql<string>`coalesce(${requisites.organizationId}, ${requisites.counterpartyId})`,
        providerId: requisites.providerId,
        currencyId: requisites.currencyId,
        kind: requisites.kind,
        label: requisites.label,
        beneficiaryName: requisites.beneficiaryName,
        notes: requisites.notes,
        currencyCode: currencyCodeSql,
      })
      .from(requisites)
      .where(and(...conditions))
      .orderBy(asc(requisites.label), asc(requisites.createdAt));
    const identifiersByRequisiteId = await this.listIdentifierRows(
      rows.map((row) => row.id),
    );

    return rows.map((row) => {
      const identifiers = identifiersByRequisiteId.get(row.id) ?? [];

      return {
        ...row,
        accountNo: findIdentifierValue(identifiers, "local_account_number"),
        accountRef: findIdentifierValue(identifiers, "account_ref"),
        address: findIdentifierValue(identifiers, "wallet_address"),
        assetCode: findIdentifierValue(identifiers, "asset_code"),
        contact: findIdentifierValue(identifiers, "contact"),
        iban: findIdentifierValue(identifiers, "iban"),
        memoTag: findIdentifierValue(identifiers, "memo_tag"),
        network: findIdentifierValue(identifiers, "network"),
        subaccountRef: findIdentifierValue(identifiers, "subaccount_ref"),
      };
    });
  }

  async listLabelsById(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await this.db
      .select({
        id: requisites.id,
        label: requisites.label,
      })
      .from(requisites)
      .where(inArray(requisites.id, uniqueIds));

    return new Map(rows.map((row) => [row.id, row.label]));
  }

  async findSubjectById(requisiteId: string) {
    const [row] = await this.listSubjectsById([requisiteId]);
    return row ?? null;
  }

  listSubjectsById(requisiteIds: string[]) {
    const uniqueIds = Array.from(new Set(requisiteIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.db
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
  }

  private async listIdentifierRows(requisiteIds: string[]) {
    const uniqueIds = Array.from(new Set(requisiteIds.filter(Boolean)));
    const result = new Map<string, RequisiteIdentifierRow[]>();

    if (uniqueIds.length === 0) {
      return result;
    }

    const rows = await this.db
      .select()
      .from(requisiteIdentifiers)
      .where(inArray(requisiteIdentifiers.requisiteId, uniqueIds))
      .orderBy(
        asc(requisiteIdentifiers.requisiteId),
        asc(requisiteIdentifiers.createdAt),
      );

    for (const row of rows) {
      const items = result.get(row.requisiteId) ?? [];
      items.push(row);
      result.set(row.requisiteId, items);
    }

    return result;
  }
}
