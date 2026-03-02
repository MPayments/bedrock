import { and, asc, desc, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema/operational-accounts";
import type { OperationalAccountProvider } from "@bedrock/db/schema/operational-accounts";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/foundation/kernel/pagination";

import type { OperationalAccountsServiceContext } from "../internal/context";
import {
  ListProvidersQuerySchema,
  type AccountProviderType,
  type ListProvidersQuery,
} from "../validation";

const SORT_COLUMN_MAP = {
  name: schema.operationalAccountProviders.name,
  type: schema.operationalAccountProviders.type,
  country: schema.operationalAccountProviders.country,
  createdAt: schema.operationalAccountProviders.createdAt,
} as const;

export function createListProvidersHandler(context: OperationalAccountsServiceContext) {
  const { db } = context;

  return async function listProviders(
    input?: ListProvidersQuery,
  ): Promise<PaginatedList<OperationalAccountProvider>> {
    const query = ListProvidersQuerySchema.parse(input ?? {});
    const { limit, offset, sortBy, sortOrder, name, type, country } = query;

    const conditions: SQL[] = [];

    if (name) {
      conditions.push(
        ilike(schema.operationalAccountProviders.name, `%${name}%`),
      );
    }

    if (type?.length) {
      conditions.push(
        inArray(
          schema.operationalAccountProviders.type,
          type as AccountProviderType[],
        ),
      );
    }

    if (country?.length) {
      conditions.push(
        inArray(schema.operationalAccountProviders.country, country),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.operationalAccountProviders.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.operationalAccountProviders)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.operationalAccountProviders)
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
