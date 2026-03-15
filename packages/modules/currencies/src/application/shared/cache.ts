import type { Currency } from "../../contracts";

export interface CurrencyCache {
  byId: Map<string, Currency>;
  byCode: Map<string, Currency>;
}

export function createCurrenciesCache() {
  let cache: CurrencyCache | null = null;

  return {
    get() {
      return cache;
    },
    set(rows: Currency[]) {
      cache = {
        byId: new Map(rows.map((currency) => [currency.id, currency])),
        byCode: new Map(rows.map((currency) => [currency.code, currency])),
      };
      return cache;
    },
    invalidate() {
      cache = null;
    },
  };
}

export type CurrenciesCacheStore = ReturnType<typeof createCurrenciesCache>;
