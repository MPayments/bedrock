import { and, asc, desc, ilike, inArray, sql, type SQL } from "drizzle-orm";

import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";
import { schema } from "@bedrock/core/counterparty-accounts/schema";
import type { CounterpartyAccountProvider } from "@bedrock/core/counterparty-accounts/schema";

import type { CounterpartyAccountsServiceContext } from "../internal/context";
import {
  ListProvidersQuerySchema,
  type AccountProviderType,
  type ListProvidersQuery,
} from "../validation";

const SORT_COLUMN_MAP = {
  name: schema.counterpartyAccountProviders.name,
  type: schema.counterpartyAccountProviders.type,
  country: schema.counterpartyAccountProviders.country,
  createdAt: schema.counterpartyAccountProviders.createdAt,
} as const;

export function createListProvidersHandler(context: CounterpartyAccountsServiceContext) {
  const { db } = context;

  return async function listProviders(
    input?: ListProvidersQuery,
  ): Promise<PaginatedList<CounterpartyAccountProvider>> {
    const query = ListProvidersQuerySchema.parse(input ?? {});
    const { limit, offset, sortBy, sortOrder, name, type, country } = query;

    const conditions: SQL[] = [];

    if (name) {
      conditions.push(
        ilike(schema.counterpartyAccountProviders.name, `%${name}%`),
      );
    }

    if (type?.length) {
      conditions.push(
        inArray(
          schema.counterpartyAccountProviders.type,
          type as AccountProviderType[],
        ),
      );
    }

    if (country?.length) {
      conditions.push(
        inArray(schema.counterpartyAccountProviders.country, country),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.counterpartyAccountProviders.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.counterpartyAccountProviders)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.counterpartyAccountProviders)
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
