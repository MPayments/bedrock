import {
  paginateInMemory,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type { Currency, ListCurrenciesQuery as ListCurrenciesQueryInput } from "../../contracts";
import { ListCurrenciesQuerySchema } from "../../contracts";
import type { CurrenciesServiceContext } from "../shared/context";
import { warmCurrenciesCache } from "../shared/warm-cache";

const SORT_COLUMN_MAP = {
  code: (currency: Currency) => currency.code,
  name: (currency: Currency) => currency.name,
  symbol: (currency: Currency) => currency.symbol,
  precision: (currency: Currency) => currency.precision,
  createdAt: (currency: Currency) => currency.createdAt,
  updatedAt: (currency: Currency) => currency.updatedAt,
} as const;

export class ListCurrenciesQuery {
  constructor(private readonly context: CurrenciesServiceContext) {}

  async execute(
    query?: ListCurrenciesQueryInput,
  ): Promise<PaginatedList<Currency>> {
    const { limit, offset, sortBy, sortOrder, name, code, symbol, precision } =
      ListCurrenciesQuerySchema.parse(query ?? {});

    const cache = await warmCurrenciesCache(this.context);
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
  }
}
