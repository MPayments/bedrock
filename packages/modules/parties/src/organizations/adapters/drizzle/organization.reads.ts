import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import { dedupeStrings as dedupeIds } from "@bedrock/shared/core/domain";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { organizations } from "./schema";
import type { Organization } from "../../application/contracts/dto";
import type { ListOrganizationsQuery } from "../../application/contracts/queries";
import type { OrganizationReads } from "../../application/ports/organization.reads";
import type { PartyKind } from "../../domain/party-kind";

const SORT_COLUMN_MAP = {
  shortName: organizations.shortName,
  fullName: organizations.fullName,
  country: organizations.country,
  kind: organizations.kind,
  isActive: organizations.isActive,
  createdAt: organizations.createdAt,
  updatedAt: organizations.updatedAt,
} as const;

function buildWhere(input: ListOrganizationsQuery): SQL | undefined {
  const conditions: SQL[] = [];

  if (input.shortName) {
    conditions.push(
      or(
        ilike(organizations.shortName, `%${input.shortName}%`),
        ilike(organizations.fullName, `%${input.shortName}%`),
      )!,
    );
  }

  if (input.fullName) {
    conditions.push(ilike(organizations.fullName, `%${input.fullName}%`));
  }

  if (input.country?.length) {
    conditions.push(inArray(organizations.country, input.country));
  }

  if (input.kind?.length) {
    conditions.push(inArray(organizations.kind, input.kind as PartyKind[]));
  }

  if (input.isActive !== undefined) {
    conditions.push(eq(organizations.isActive, input.isActive));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export class DrizzleOrganizationReads implements OrganizationReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Organization | null> {
    const [row] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    return row ?? null;
  }

  async list(input: ListOrganizationsQuery): Promise<PaginatedList<Organization>> {
    const where = buildWhere(input);
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      SORT_COLUMN_MAP,
      organizations.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(organizations)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(organizations)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  listInternalLedgerOrganizations() {
    return this.db
      .select({
        id: organizations.id,
        shortName: organizations.shortName,
      })
      .from(organizations)
      .orderBy(organizations.shortName);
  }

  async listShortNamesById(ids: string[]) {
    const uniqueIds = dedupeIds(ids);
    if (uniqueIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await this.db
      .select({
        id: organizations.id,
        shortName: organizations.shortName,
      })
      .from(organizations)
      .where(inArray(organizations.id, uniqueIds));

    return new Map(rows.map((row) => [row.id, row.shortName]));
  }

  async listExistingOrganizationIds(ids: string[]) {
    const uniqueIds = dedupeIds(ids);
    if (uniqueIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(inArray(organizations.id, uniqueIds));

    return rows.map((row) => row.id);
  }
}
