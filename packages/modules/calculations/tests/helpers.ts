import { eq } from "drizzle-orm";
import { vi } from "vitest";

import { schema as currenciesSchema } from "@bedrock/currencies/schema";

interface CurrencyFixture {
  id: string;
  code: string;
  name?: string;
  symbol?: string;
  precision?: number;
}

export const CURRENCY_IDS = {
  USD: "00000000-0000-4000-8000-000000000101",
  EUR: "00000000-0000-4000-8000-000000000102",
  RUB: "00000000-0000-4000-8000-000000000104",
  AED: "00000000-0000-4000-8000-000000000105",
  USDT: "00000000-0000-4000-8000-000000000106",
  CNY: "00000000-0000-4000-8000-000000000107",
  GBP: "00000000-0000-4000-8000-000000000108",
  JPY: "00000000-0000-4000-8000-000000000109",
} as const;

const DEFAULT_CURRENCIES: CurrencyFixture[] = [
  { id: "cur-usd", code: "USD", name: "US Dollar", symbol: "$", precision: 2 },
  { id: "cur-eur", code: "EUR", name: "Euro", symbol: "EUR", precision: 2 },
  { id: "cur-rub", code: "RUB", name: "Russian Ruble", symbol: "RUB", precision: 2 },
  { id: "cur-aed", code: "AED", name: "UAE Dirham", symbol: "AED", precision: 2 },
  { id: "cur-usdt", code: "USDT", name: "Tether", symbol: "USDT", precision: 6 },
  { id: "cur-btc", code: "BTC", name: "Bitcoin", symbol: "BTC", precision: 8 },
];

const SEEDED_CURRENCIES: CurrencyFixture[] = [
  {
    id: CURRENCY_IDS.USD,
    code: "USD",
    name: "Доллар США",
    symbol: "$",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.EUR,
    code: "EUR",
    name: "Евро",
    symbol: "EUR",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.RUB,
    code: "RUB",
    name: "Российский рубль",
    symbol: "RUB",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.AED,
    code: "AED",
    name: "Дирхам ОАЭ",
    symbol: "AED",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.CNY,
    code: "CNY",
    name: "Китайский юань",
    symbol: "CNY",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.GBP,
    code: "GBP",
    name: "Британский фунт",
    symbol: "GBP",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.JPY,
    code: "JPY",
    name: "Японский йен",
    symbol: "JPY",
    precision: 0,
  },
  {
    id: CURRENCY_IDS.USDT,
    code: "USDT",
    name: "Tether USD",
    symbol: "USDT",
    precision: 2,
  },
];

export function currencyIdForCode(code: string): string {
  const normalized = code.trim().toUpperCase() as keyof typeof CURRENCY_IDS;
  const id = CURRENCY_IDS[normalized];
  if (!id) {
    throw new Error(`Unsupported test currency: ${code}`);
  }

  return id;
}

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

export async function seedCurrencies(db: any): Promise<void> {
  for (const fixture of SEEDED_CURRENCIES) {
    const [existing] = await db
      .select({ id: currenciesSchema.currencies.id })
      .from(currenciesSchema.currencies)
      .where(eq(currenciesSchema.currencies.code, fixture.code))
      .limit(1);

    if (!existing) {
      await db.insert(currenciesSchema.currencies).values({
        id: currencyIdForCode(fixture.code),
        code: fixture.code,
        name: fixture.name ?? fixture.code,
        symbol: fixture.symbol ?? fixture.code,
        precision: fixture.precision ?? 2,
      });
      continue;
    }

    if (existing.id !== currencyIdForCode(fixture.code)) {
      await db
        .update(currenciesSchema.currencies)
        .set({
          id: currencyIdForCode(fixture.code),
          name: fixture.name ?? fixture.code,
          symbol: fixture.symbol ?? fixture.code,
          precision: fixture.precision ?? 2,
        })
        .where(eq(currenciesSchema.currencies.code, fixture.code));
      continue;
    }

    await db
      .update(currenciesSchema.currencies)
      .set({
        name: fixture.name ?? fixture.code,
        symbol: fixture.symbol ?? fixture.code,
        precision: fixture.precision ?? 2,
      })
      .where(eq(currenciesSchema.currencies.code, fixture.code));
  }
}

export function createNoopFeesService() {
  return {
    calculateQuoteFeeComponents: vi.fn(async () => []),
  } as any;
}
