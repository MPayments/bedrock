import { eq } from "drizzle-orm";

import {
  schema,
  type Currency,
  type CurrencyInsert,
} from "@bedrock/currencies/schema";
import {
  paginateInMemory,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/common/pagination";

import { CurrencyDeleteConflictError, CurrencyNotFoundError } from "./errors";
import {
  createCurrenciesServiceContext,
  type CurrenciesServiceDeps,
} from "./internal/context";
import type { ListCurrenciesQuery, UpdateCurrencyInput } from "./validation";
import {
  CreateCurrencyInputSchema,
  ListCurrenciesQuerySchema,
  UpdateCurrencyInputSchema,
} from "./validation";

interface CurrencyCache {
  byId: Map<string, Currency>;
  byCode: Map<string, Currency>;
}

const SORT_COLUMN_MAP = {
  code: (currency: Currency) => currency.code,
  name: (currency: Currency) => currency.name,
  symbol: (currency: Currency) => currency.symbol,
  precision: (currency: Currency) => currency.precision,
  createdAt: (currency: Currency) => currency.createdAt,
  updatedAt: (currency: Currency) => currency.updatedAt,
} as const;

function hasForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23503") {
    return true;
  }

  return hasForeignKeyViolation(candidate.cause);
}

export type CurrenciesService = ReturnType<typeof createCurrenciesService>;

export function createCurrenciesService(deps: CurrenciesServiceDeps) {
  const { db, log } = createCurrenciesServiceContext(deps);

  // Populated lazily on first read, invalidated on every write.
  // Safe for single-process deployments; for multi-instance add a
  // pub/sub invalidation signal (e.g. pg NOTIFY) if needed.
  let cache: CurrencyCache | null = null;

  async function warmCache() {
    if (cache) return cache;
    const rows = await db.select().from(schema.currencies);
    cache = {
      byId: new Map(rows.map((c) => [c.id, c])),
      byCode: new Map(rows.map((c) => [c.code, c])),
    };
    log.debug("currencies cache warmed", { count: rows.length });
    return cache;
  }

  function invalidateCache() {
    cache = null;
  }

  async function list(
    query?: ListCurrenciesQuery,
  ): Promise<PaginatedList<Currency>> {
    const { limit, offset, sortBy, sortOrder, name, code, symbol, precision } =
      ListCurrenciesQuerySchema.parse(query ?? {});

    const c = await warmCache();
    let all = [...c.byId.values()];

    if (name) {
      const normalizedName = name.toLowerCase();
      all = all.filter((currency) =>
        currency.name.toLowerCase().includes(normalizedName),
      );
    }

    if (code) {
      const normalizedCode = code.toLowerCase();
      all = all.filter((currency) =>
        currency.code.toLowerCase().includes(normalizedCode),
      );
    }

    if (symbol) {
      const normalizedSymbol = symbol.toLowerCase();
      all = all.filter((currency) =>
        currency.symbol.toLowerCase().includes(normalizedSymbol),
      );
    }

    if (precision !== undefined) {
      all = all.filter((currency) => currency.precision === precision);
    }

    const sorted = sortInMemory(all, {
      sortBy,
      sortOrder,
      sortMap: SORT_COLUMN_MAP,
    });

    return paginateInMemory(sorted, { limit, offset });
  }

  async function findById(id: string) {
    const c = await warmCache();
    const currency = c.byId.get(id);

    if (!currency) throw new CurrencyNotFoundError(id);

    return currency;
  }

  async function findByCode(code: string) {
    const c = await warmCache();
    const currency = c.byCode.get(code.toUpperCase());

    if (!currency) throw new CurrencyNotFoundError(code);

    return currency;
  }

  async function create(input: CurrencyInsert) {
    const validated = CreateCurrencyInputSchema.parse(input);

    const [row] = await db
      .insert(schema.currencies)
      .values(validated)
      .returning();

    invalidateCache();

    return row!;
  }

  async function update(id: string, input: UpdateCurrencyInput) {
    const validated = UpdateCurrencyInputSchema.parse(input);

    const [row] = await db
      .update(schema.currencies)
      .set(validated)
      .where(eq(schema.currencies.id, id))
      .returning();

    if (!row) throw new CurrencyNotFoundError(id);
    invalidateCache();

    return row;
  }

  async function remove(id: string): Promise<void> {
    try {
      const [deleted] = await db
        .delete(schema.currencies)
        .where(eq(schema.currencies.id, id))
        .returning({ id: schema.currencies.id });

      if (!deleted) {
        throw new CurrencyNotFoundError(id);
      }
    } catch (error) {
      if (error instanceof CurrencyNotFoundError) {
        throw error;
      }

      if (hasForeignKeyViolation(error)) {
        throw new CurrencyDeleteConflictError(id);
      }

      throw error;
    }

    invalidateCache();
  }

  return {
    list,
    findById,
    findByCode,
    create,
    update,
    remove,
  };
}
