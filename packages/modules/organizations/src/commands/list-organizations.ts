import { and, asc, desc, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";

import type { OrganizationsServiceContext } from "../internal/context";
import type { PartyKind } from "../party-types";
import { schema } from "../schema";
import {
  ListOrganizationsQuerySchema,
  type ListOrganizationsQuery,
  type Organization,
} from "../validation";

const SORT_COLUMN_MAP = {
  shortName: schema.organizations.shortName,
  fullName: schema.organizations.fullName,
  country: schema.organizations.country,
  kind: schema.organizations.kind,
  createdAt: schema.organizations.createdAt,
  updatedAt: schema.organizations.updatedAt,
} as const;

export function createListOrganizationsHandler(
  context: OrganizationsServiceContext,
) {
  const { db } = context;

  return async function listOrganizations(
    input?: ListOrganizationsQuery,
  ): Promise<PaginatedList<Organization>> {
    const query = ListOrganizationsQuerySchema.parse(input ?? {});
    const {
      limit,
      offset,
      sortBy,
      sortOrder,
      shortName,
      fullName,
      country,
      kind,
    } = query;

    const conditions: SQL[] = [];

    if (shortName) {
      conditions.push(
        or(
          ilike(schema.organizations.shortName, `%${shortName}%`),
          ilike(schema.organizations.fullName, `%${shortName}%`),
        )!,
      );
    }

    if (fullName) {
      conditions.push(ilike(schema.organizations.fullName, `%${fullName}%`));
    }

    if (country?.length) {
      conditions.push(inArray(schema.organizations.country, country));
    }

    if (kind?.length) {
      conditions.push(inArray(schema.organizations.kind, kind as PartyKind[]));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.organizations.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.organizations)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.organizations)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit,
      offset,
    };
  };
}
