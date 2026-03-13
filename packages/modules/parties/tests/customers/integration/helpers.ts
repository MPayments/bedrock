import { eq } from "drizzle-orm";

import { schema as currenciesSchema } from "@bedrock/currencies/schema";

const CURRENCY_FIXTURES = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    precision: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    code: "EUR",
    name: "Euro",
    symbol: "EUR",
    precision: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    code: "RUB",
    name: "Russian Ruble",
    symbol: "RUB",
    precision: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    code: "AED",
    name: "UAE Dirham",
    symbol: "AED",
    precision: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    code: "USDT",
    name: "Tether",
    symbol: "USDT",
    precision: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000107",
    code: "CNY",
    name: "Chinese Yuan",
    symbol: "CNY",
    precision: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000108",
    code: "GBP",
    name: "British Pound",
    symbol: "GBP",
    precision: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000109",
    code: "JPY",
    name: "Japanese Yen",
    symbol: "JPY",
    precision: 0,
  },
] as const;

export async function seedCurrencies(db: any): Promise<void> {
  for (const fixture of CURRENCY_FIXTURES) {
    const [existing] = await db
      .select({ id: currenciesSchema.currencies.id })
      .from(currenciesSchema.currencies)
      .where(eq(currenciesSchema.currencies.code, fixture.code))
      .limit(1);

    if (!existing) {
      await db.insert(currenciesSchema.currencies).values(fixture);
      continue;
    }

    if (existing.id !== fixture.id) {
      await db
        .update(currenciesSchema.currencies)
        .set({
          id: fixture.id,
          name: fixture.name,
          symbol: fixture.symbol,
          precision: fixture.precision,
        })
        .where(eq(currenciesSchema.currencies.code, fixture.code));
      continue;
    }

    await db
      .update(currenciesSchema.currencies)
      .set({
        name: fixture.name,
        symbol: fixture.symbol,
        precision: fixture.precision,
      })
      .where(eq(currenciesSchema.currencies.code, fixture.code));
  }
}
