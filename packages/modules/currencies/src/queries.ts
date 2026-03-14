import { inArray } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import { schema } from "./schema";

type Queryable = Database | Transaction;

export interface CurrenciesQueries {
  listPrecisionsByCode: (codes: string[]) => Promise<Map<string, number>>;
}

export function createCurrenciesQueries(input: { db: Queryable }): CurrenciesQueries {
  const { db } = input;

  return {
    async listPrecisionsByCode(codes: string[]) {
      const uniqueCodes = Array.from(
        new Set(codes.map((code) => code.trim()).filter(Boolean)),
      );
      if (uniqueCodes.length === 0) {
        return new Map();
      }

      const rows = await db
        .select({
          code: schema.currencies.code,
          precision: schema.currencies.precision,
        })
        .from(schema.currencies)
        .where(inArray(schema.currencies.code, uniqueCodes));

      return new Map(rows.map((row) => [row.code, row.precision]));
    },
  };
}
