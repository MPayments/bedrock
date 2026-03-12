import { vi } from "vitest";

interface CurrencyFixture {
  id: string;
  code: string;
  name?: string;
  symbol?: string;
  precision?: number;
}

const DEFAULT_CURRENCIES: CurrencyFixture[] = [
  { id: "cur-usd", code: "USD", name: "US Dollar", symbol: "$", precision: 2 },
  { id: "cur-eur", code: "EUR", name: "Euro", symbol: "EUR", precision: 2 },
  { id: "cur-rub", code: "RUB", name: "Russian Ruble", symbol: "RUB", precision: 2 },
  { id: "cur-aed", code: "AED", name: "UAE Dirham", symbol: "AED", precision: 2 },
  { id: "cur-usdt", code: "USDT", name: "Tether", symbol: "USDT", precision: 6 },
  { id: "cur-btc", code: "BTC", name: "Bitcoin", symbol: "BTC", precision: 8 },
];

export function createMockCurrenciesService(
  fixtures: CurrencyFixture[] = DEFAULT_CURRENCIES,
) {
  const byCode = new Map<string, any>(
    fixtures.map((fixture) => [
      fixture.code,
      {
        id: fixture.id,
        code: fixture.code,
        name: fixture.name ?? fixture.code,
        symbol: fixture.symbol ?? fixture.code,
        precision: fixture.precision ?? 2,
      },
    ]),
  );
  const byId = new Map<string, any>(
    Array.from(byCode.values()).map((currency) => [currency.id, currency]),
  );

  return {
    findByCode: vi.fn(async (code: string) => {
      const normalized = code.trim().toUpperCase();
      const existing = byCode.get(normalized);
      if (existing) {
        return existing;
      }

      const generated = {
        id: `cur-${normalized.toLowerCase()}`,
        code: normalized,
        name: normalized,
        symbol: normalized,
        precision: 2,
      };
      byCode.set(normalized, generated);
      byId.set(generated.id, generated);
      return generated;
    }),
    findById: vi.fn(async (id: string) => {
      const existing = byId.get(id);
      if (existing) {
        return existing;
      }

      throw new Error(`Unknown currency id: ${id}`);
    }),
  };
}

export function createNoopFeesService() {
  return {
    calculateFxQuoteFeeComponents: vi.fn(async () => []),
    saveQuoteFeeComponents: vi.fn(async () => undefined),
    getQuoteFeeComponents: vi.fn(async () => []),
  } as any;
}
