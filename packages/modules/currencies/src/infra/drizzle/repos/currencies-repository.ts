import { eq, inArray } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type { CurrenciesRepositoryPort } from "../../../application/ports";
import type {
  CreateCurrencyInput,
  UpdateCurrencyInput,
} from "../../../contracts";
import { schema } from "../schema";

export function createDrizzleCurrenciesRepository(input: {
  db: Queryable;
}): CurrenciesRepositoryPort {
  const { db } = input;

  return {
    async listAll(executor = db) {
      return executor.select().from(schema.currencies);
    },

    async findById(id, executor = db) {
      const [row] = await executor
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .limit(1);

      return row ?? null;
    },

    async findByCode(code, executor = db) {
      const [row] = await executor
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.code, code.toUpperCase()))
        .limit(1);

      return row ?? null;
    },

    async create(inputValue: CreateCurrencyInput, executor = db) {
      const [row] = await executor
        .insert(schema.currencies)
        .values(inputValue)
        .returning();

      return row!;
    },

    async update(id, inputValue: UpdateCurrencyInput, executor = db) {
      const [row] = await executor
        .update(schema.currencies)
        .set(inputValue)
        .where(eq(schema.currencies.id, id))
        .returning();

      return row ?? null;
    },

    async remove(id, executor = db) {
      const [deleted] = await executor
        .delete(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .returning({ id: schema.currencies.id });

      return Boolean(deleted);
    },

    async listPrecisionsByCode(codes, executor = db) {
      const rows = await executor
        .select({
          code: schema.currencies.code,
          precision: schema.currencies.precision,
        })
        .from(schema.currencies)
        .where(inArray(schema.currencies.code, codes));

      return new Map(rows.map((row) => [row.code, row.precision]));
    },
  };
}
