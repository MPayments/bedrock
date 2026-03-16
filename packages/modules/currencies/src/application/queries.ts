import {
  paginateInMemory,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type { Currency, ListCurrenciesQuery } from "../contracts";
import { ListCurrenciesQuerySchema } from "../contracts";
import type {
  CurrenciesQueriesContext,
  CurrenciesServiceContext,
} from "./shared/context";

const SORT_COLUMN_MAP = {
  code: (currency: Currency) => currency.code,
  name: (currency: Currency) => currency.name,
  symbol: (currency: Currency) => currency.symbol,
  precision: (currency: Currency) => currency.precision,
  createdAt: (currency: Currency) => currency.createdAt,
  updatedAt: (currency: Currency) => currency.updatedAt,
} as const;

async function warmCache(context: CurrenciesServiceContext) {
  const cached = context.cache.get();
  if (cached) {
    return cached;
  }

  const rows = await context.queries.listAll();
  const next = context.cache.set(rows);
  context.log.debug("currencies cache warmed", { count: rows.length });
  return next;
}

export function createListCurrenciesHandler(context: CurrenciesServiceContext) {
  return async function listCurrencies(
    query?: ListCurrenciesQuery,
  ): Promise<PaginatedList<Currency>> {
    const { limit, offset, sortBy, sortOrder, name, code, symbol, precision } =
      ListCurrenciesQuerySchema.parse(query ?? {});

    const cache = await warmCache(context);
    let all = [...cache.byId.values()];

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
  };
}

export function createFindCurrencyByIdHandler(
  context: CurrenciesServiceContext,
) {
  return async function findCurrencyById(id: string): Promise<Currency | null> {
    const cache = await warmCache(context);
    return cache.byId.get(id) ?? null;
  };
}

export function createFindCurrencyByCodeHandler(
  context: CurrenciesServiceContext,
) {
  return async function findCurrencyByCode(
    code: string,
  ): Promise<Currency | null> {
    const cache = await warmCache(context);
    return cache.byCode.get(code.toUpperCase()) ?? null;
  };
}

export function createListCurrencyPrecisionsByCodeHandler(
  context: CurrenciesQueriesContext,
) {
  return async function listPrecisionsByCode(
    codes: string[],
  ): Promise<Map<string, number>> {
    const uniqueCodes = Array.from(
      new Set(codes.map((code) => code.trim()).filter(Boolean)),
    );

    if (uniqueCodes.length === 0) {
      return new Map();
    }

    return context.queries.listPrecisionsByCode(uniqueCodes);
  };
}
