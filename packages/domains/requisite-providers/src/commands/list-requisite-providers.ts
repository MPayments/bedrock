import {
  and,
  asc,
  desc,
  ilike,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/common/pagination";

import type { RequisiteKind } from "@multihansa/requisites/shared";

import type { RequisiteProvidersServiceContext } from "../internal/context";
import { schema } from "../schema";
import {
  ListRequisiteProvidersQuerySchema,
  type ListRequisiteProvidersQuery,
  type RequisiteProvider,
} from "../validation";

const SORT_COLUMN_MAP = {
  name: schema.requisiteProviders.name,
  kind: schema.requisiteProviders.kind,
  country: schema.requisiteProviders.country,
  createdAt: schema.requisiteProviders.createdAt,
  updatedAt: schema.requisiteProviders.updatedAt,
} as const;

export function createListRequisiteProvidersHandler(
  context: RequisiteProvidersServiceContext,
) {
  const { db } = context;

  return async function listRequisiteProviders(
    input?: ListRequisiteProvidersQuery,
  ): Promise<PaginatedList<RequisiteProvider>> {
    const query = ListRequisiteProvidersQuerySchema.parse(input ?? {});
    const { limit, offset, sortBy, sortOrder, name, kind, country } = query;

    const conditions: SQL[] = [isNull(schema.requisiteProviders.archivedAt)];

    if (name) {
      conditions.push(ilike(schema.requisiteProviders.name, `%${name}%`));
    }
    if (kind?.length) {
      conditions.push(inArray(schema.requisiteProviders.kind, kind as RequisiteKind[]));
    }
    if (country?.length) {
      conditions.push(inArray(schema.requisiteProviders.country, country));
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.requisiteProviders.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.requisiteProviders)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.requisiteProviders)
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
