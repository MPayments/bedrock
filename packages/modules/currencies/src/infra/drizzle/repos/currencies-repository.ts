import { eq, inArray } from "drizzle-orm";

import type {
  Database,
  Transaction,
} from "@bedrock/platform/persistence";

import type {
  CurrenciesCommandRepository,
  CurrenciesQueryRepository,
} from "../../../application/currencies/ports";
import type {
  CreateCurrencyInput,
  UpdateCurrencyInput,
} from "../../../contracts";
import { schema } from "../schema";

export function createDrizzleCurrenciesQueryRepository(input: {
  db: Database | Transaction;
}): CurrenciesQueryRepository {
  const { db } = input;

  return {
    async listAll() {
      return db.select().from(schema.currencies);
    },

    async findById(id) {
      const [row] = await db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .limit(1);

      return row ?? null;
    },

    async findByCode(code) {
      const [row] = await db
        .select()
        .from(schema.currencies)
        .where(eq(schema.currencies.code, code.toUpperCase()))
        .limit(1);

      return row ?? null;
    },

    async listPrecisionsByCode(codes) {
      const rows = await db
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

export function createDrizzleCurrenciesCommandRepository(input: {
  db: Database | Transaction;
}): CurrenciesCommandRepository {
  const { db } = input;

  return {
    async create(inputValue: CreateCurrencyInput, tx) {
      const queryable = (tx as Transaction | undefined) ?? db;
      const [row] = await queryable
        .insert(schema.currencies)
        .values(inputValue)
        .returning();

      return row!;
    },

    async update(id, inputValue: UpdateCurrencyInput, tx) {
      const queryable = (tx as Transaction | undefined) ?? db;
      const [row] = await queryable
        .update(schema.currencies)
        .set(inputValue)
        .where(eq(schema.currencies.id, id))
        .returning();

      return row ?? null;
    },

    async remove(id, tx) {
      const queryable = (tx as Transaction | undefined) ?? db;
      const [deleted] = await queryable
        .delete(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .returning({ id: schema.currencies.id });

      return Boolean(deleted);
    },
  };
}
