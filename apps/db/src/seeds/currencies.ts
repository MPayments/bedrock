import { eq } from "drizzle-orm";

import type { Database } from "../client";
import { schema } from "../schema-registry";

export const CURRENCY_IDS = {
  USD: "00000000-0000-4000-8000-000000000101",
  EUR: "00000000-0000-4000-8000-000000000102",
  RUB: "00000000-0000-4000-8000-000000000104",
  AED: "00000000-0000-4000-8000-000000000105",
  USDT: "00000000-0000-4000-8000-000000000106",
  CNY: "00000000-0000-4000-8000-000000000107",
  GBP: "00000000-0000-4000-8000-000000000108",
  JPY: "00000000-0000-4000-8000-000000000109",
  TRY: "00000000-0000-4000-8000-000000000110",
} as const;

export function currencyIdForCode(code: string): string {
  const normalized = code.trim().toUpperCase() as keyof typeof CURRENCY_IDS;
  const id = CURRENCY_IDS[normalized];
  if (!id) throw new Error(`Unsupported test currency: ${code}`);
  return id;
}

const CURRENCY_SEEDS = [
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
    symbol: "€",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.RUB,
    code: "RUB",
    name: "Российский рубль",
    symbol: "₽",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.AED,
    code: "AED",
    name: "Дирхам ОАЭ",
    symbol: "د.إ",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.CNY,
    code: "CNY",
    name: "Китайский юань",
    symbol: "¥",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.GBP,
    code: "GBP",
    name: "Британский фунт",
    symbol: "£",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.JPY,
    code: "JPY",
    name: "Японский йен",
    symbol: "¥",
    precision: 0,
  },
  {
    id: CURRENCY_IDS.TRY,
    code: "TRY",
    name: "Турецкая лира",
    symbol: "₺",
    precision: 2,
  },
  {
    id: CURRENCY_IDS.USDT,
    code: "USDT",
    name: "Tether USD",
    symbol: "₮",
    precision: 2,
  },
] as const;

export async function seedCurrencies(db: Database): Promise<void> {
  for (const row of CURRENCY_SEEDS) {
    const [existing] = await db
      .select({ id: schema.currencies.id })
      .from(schema.currencies)
      .where(eq(schema.currencies.code, row.code))
      .limit(1);

    if (!existing) {
      await db.insert(schema.currencies).values({
        id: row.id,
        code: row.code,
        name: row.name,
        symbol: row.symbol,
        precision: row.precision,
      });
      continue;
    }

    if (existing.id !== row.id) {
      await db
        .update(schema.currencies)
        .set({
          id: row.id,
          name: row.name,
          symbol: row.symbol,
          precision: row.precision,
        })
        .where(eq(schema.currencies.code, row.code));
      continue;
    }

    await db
      .update(schema.currencies)
      .set({
        name: row.name,
        symbol: row.symbol,
        precision: row.precision,
      })
      .where(eq(schema.currencies.code, row.code));
  }
}
