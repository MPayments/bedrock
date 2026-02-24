import { and, asc, desc, ilike, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/kernel/pagination";

import type { CustomersServiceContext } from "../internal/context";
import {
  ListCustomersQuerySchema,
  type Customer,
  type ListCustomersQuery,
} from "../validation";

const SORT_COLUMN_MAP = {
  displayName: schema.customers.displayName,
  externalRef: schema.customers.externalRef,
  createdAt: schema.customers.createdAt,
  updatedAt: schema.customers.updatedAt,
} as const;

export function createListCustomersHandler(context: CustomersServiceContext) {
  const { db } = context;

  return async function listCustomers(
    input?: ListCustomersQuery,
  ): Promise<PaginatedList<Customer>> {
    const query = ListCustomersQuerySchema.parse(input ?? {});
    const { limit, offset, sortBy, sortOrder, displayName, externalRef } =
      query;

    const conditions: SQL[] = [];

    if (displayName) {
      conditions.push(ilike(schema.customers.displayName, `%${displayName}%`));
    }

    if (externalRef) {
      conditions.push(ilike(schema.customers.externalRef, `%${externalRef}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      schema.customers.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(schema.customers)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.customers)
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
