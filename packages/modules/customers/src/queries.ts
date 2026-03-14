import { inArray } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import { schema } from "./schema";

type Queryable = Database | Transaction;

export interface CustomersQueries {
  listDisplayNamesById: (ids: string[]) => Promise<Map<string, string>>;
}

export function createCustomersQueries(input: { db: Queryable }): CustomersQueries {
  const { db } = input;

  return {
    async listDisplayNamesById(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await db
        .select({
          id: schema.customers.id,
          displayName: schema.customers.displayName,
        })
        .from(schema.customers)
        .where(inArray(schema.customers.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.displayName]));
    },
  };
}
