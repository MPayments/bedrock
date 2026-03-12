import { eq } from "drizzle-orm";

import { schema, type Currency, type CurrencyInsert } from "@multihansa/assets/schema";
import {
    paginateInMemory,
    sortInMemory,
    type PaginatedList,
} from "@multihansa/common/pagination";

import {
    createCurrenciesServiceContext,
    type CurrenciesServiceContext,
} from "./context";
import {
    CurrencyDeleteConflictError,
    CurrencyNotFoundError,
} from "./errors";
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

export interface CurrencyCacheState {
    value: CurrencyCache | null;
}

export interface CurrenciesService {
    list(query?: ListCurrenciesQuery): Promise<PaginatedList<Currency>>;
    findById(id: string): Promise<Currency>;
    findByCode(code: string): Promise<Currency>;
    create(input: CurrencyInsert): Promise<Currency>;
    update(id: string, input: UpdateCurrencyInput): Promise<Currency>;
    remove(id: string): Promise<void>;
}

export function createCurrencyCacheState(): CurrencyCacheState {
    return {
        value: null,
    };
}

async function warmCache(
    context: CurrenciesServiceContext,
    cacheState: CurrencyCacheState,
): Promise<CurrencyCache> {
    if (cacheState.value) {
        return cacheState.value;
    }

    const rows = await context.db.select().from(schema.currencies);
    cacheState.value = {
        byId: new Map(rows.map((currency) => [currency.id, currency])),
        byCode: new Map(rows.map((currency) => [currency.code, currency])),
    };
    context.log.debug("currencies cache warmed", { count: rows.length });

    return cacheState.value;
}

function invalidateCache(cacheState: CurrencyCacheState): void {
    cacheState.value = null;
}

export async function listCurrencies(
    context: CurrenciesServiceContext,
    cacheState: CurrencyCacheState,
    query?: ListCurrenciesQuery,
): Promise<PaginatedList<Currency>> {
        const {
            limit,
            offset,
            sortBy,
            sortOrder,
            name,
            code,
            symbol,
            precision,
        } = ListCurrenciesQuerySchema.parse(query ?? {});

        const c = await warmCache(context, cacheState);
        let all = [...c.byId.values()];

        if (name) {
            const normalizedName = name.toLowerCase();
            all = all.filter((currency) => currency.name.toLowerCase().includes(normalizedName));
        }

        if (code) {
            const normalizedCode = code.toLowerCase();
            all = all.filter((currency) => currency.code.toLowerCase().includes(normalizedCode));
        }

        if (symbol) {
            const normalizedSymbol = symbol.toLowerCase();
            all = all.filter((currency) => currency.symbol.toLowerCase().includes(normalizedSymbol));
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

export async function findCurrencyById(
    context: CurrenciesServiceContext,
    cacheState: CurrencyCacheState,
    id: string,
): Promise<Currency> {
        const c = await warmCache(context, cacheState);
        const currency = c.byId.get(id);

        if (!currency) throw new CurrencyNotFoundError(id);

        return currency;
}

export async function findCurrencyByCode(
    context: CurrenciesServiceContext,
    cacheState: CurrencyCacheState,
    code: string,
): Promise<Currency> {
        const c = await warmCache(context, cacheState);
        const currency = c.byCode.get(code.toUpperCase());

        if (!currency) throw new CurrencyNotFoundError(code);

        return currency;
}

export async function createCurrency(
    context: CurrenciesServiceContext,
    cacheState: CurrencyCacheState,
    input: CurrencyInsert,
): Promise<Currency> {
        const validated = CreateCurrencyInputSchema.parse(input);

        const [row] = await context.db
            .insert(schema.currencies)
            .values(validated)
            .returning();

        invalidateCache(cacheState);

        return row!;
}

export async function updateCurrency(
        context: CurrenciesServiceContext,
        cacheState: CurrencyCacheState,
        id: string,
        input: UpdateCurrencyInput,
    ): Promise<Currency> {
        const validated = UpdateCurrencyInputSchema.parse(input);

        const [row] = await context.db
            .update(schema.currencies)
            .set(validated)
            .where(eq(schema.currencies.id, id))
            .returning();

        if (!row) throw new CurrencyNotFoundError(id);
        invalidateCache(cacheState);

        return row;
}

export async function removeCurrency(
    context: CurrenciesServiceContext,
    cacheState: CurrencyCacheState,
    id: string,
): Promise<void> {
        try {
            const [deleted] = await context.db
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

    invalidateCache(cacheState);
}
