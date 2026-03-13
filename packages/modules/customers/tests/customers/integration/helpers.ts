import type { Pool } from "pg";

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

export async function seedCurrencies(pool: Pool): Promise<void> {
  for (const fixture of CURRENCY_FIXTURES) {
    await pool.query(
      `
        INSERT INTO currencies (id, code, name, symbol, precision)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code) DO UPDATE
        SET
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          precision = EXCLUDED.precision
      `,
      [
        fixture.id,
        fixture.code,
        fixture.name,
        fixture.symbol,
        fixture.precision,
      ],
    );
  }
}
