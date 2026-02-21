import { eq } from "drizzle-orm";
import { seed } from "drizzle-seed";

import type { Database } from "../client";
import { schema } from "../schema";

export const CURRENCY_IDS = {
    USD: "00000000-0000-4000-8000-000000000101",
    EUR: "00000000-0000-4000-8000-000000000102",
    GBP: "00000000-0000-4000-8000-000000000103",
    RUB: "00000000-0000-4000-8000-000000000104",
    AED: "00000000-0000-4000-8000-000000000105",
    USDT: "00000000-0000-4000-8000-000000000106",
    CNY: "00000000-0000-4000-8000-000000000107",
    TRY: "00000000-0000-4000-8000-000000000108",
} as const;

export function currencyIdForCode(code: string): string {
    const normalized = code.trim().toUpperCase() as keyof typeof CURRENCY_IDS;
    const id = CURRENCY_IDS[normalized];
    if (!id) throw new Error(`Unsupported test currency: ${code}`);
    return id;
}

const CURRENCY_SEEDS = [
    { id: CURRENCY_IDS.USD, code: "USD", name: "US Dollar", symbol: "$", precision: 2 },
    { id: CURRENCY_IDS.EUR, code: "EUR", name: "Euro", symbol: "€", precision: 2 },
    { id: CURRENCY_IDS.GBP, code: "GBP", name: "Pound Sterling", symbol: "£", precision: 2 },
    { id: CURRENCY_IDS.RUB, code: "RUB", name: "Russian Ruble", symbol: "₽", precision: 2 },
    { id: CURRENCY_IDS.AED, code: "AED", name: "UAE Dirham", symbol: "د.إ", precision: 2 },
    { id: CURRENCY_IDS.CNY, code: "CNY", name: "Chinese Yuan", symbol: "¥", precision: 2 },
    { id: CURRENCY_IDS.TRY, code: "TRY", name: "Turkish Lira", symbol: "₺", precision: 2 },
    { id: CURRENCY_IDS.USDT, code: "USDT", name: "Tether", symbol: "₮", precision: 2 },
] as const;

async function seedCurrencyRow(db: Database, row: (typeof CURRENCY_SEEDS)[number], rowSeed: number) {
    await seed(db, { currencies: schema.currencies }, { count: 1, seed: rowSeed }).refine((funcs) => ({
        currencies: {
            columns: {
                id: funcs.default({ defaultValue: row.id }),
                code: funcs.default({ defaultValue: row.code }),
                name: funcs.default({ defaultValue: row.name }),
                symbol: funcs.default({ defaultValue: row.symbol }),
                precision: funcs.default({ defaultValue: row.precision }),
            },
        },
    }));
}

export async function seedCurrencies(db: Database): Promise<void> {
    for (let i = 0; i < CURRENCY_SEEDS.length; i++) {
        const row = CURRENCY_SEEDS[i]!;
        const [existing] = await db
            .select({ id: schema.currencies.id })
            .from(schema.currencies)
            .where(eq(schema.currencies.code, row.code))
            .limit(1);

        if (!existing) {
            await seedCurrencyRow(db, row, i + 1);
            continue;
        }

        if (existing.id !== row.id) {
            throw new Error(
                `Currency id mismatch for code ${row.code}: expected ${row.id}, got ${existing.id}`,
            );
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
