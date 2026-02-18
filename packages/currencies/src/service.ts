import { eq } from "drizzle-orm";

import { schema, type Currency, type CurrencyInsert } from "@bedrock/db/schema";
import {
    PaginationInputSchema,
    type PaginationInput,
    type PaginatedList,
} from "@bedrock/kernel/pagination";

import { CurrencyNotFoundError } from "./errors";
import {
    createCurrenciesServiceContext,
    type CurrenciesServiceDeps,
} from "./internal/context";
import type { UpdateCurrencyInput} from "./validation";
import { CreateCurrencyInputSchema, UpdateCurrencyInputSchema } from "./validation";

interface CurrencyCache {
    byId: Map<string, Currency>;
    byCode: Map<string, Currency>;
}

export type CurrenciesService = ReturnType<typeof createCurrenciesService>;

export function createCurrenciesService(deps: CurrenciesServiceDeps) {
    const { db, log } = createCurrenciesServiceContext(deps);

    // Populated lazily on first read, invalidated on every write.
    // Safe for single-process deployments; for multi-instance add a
    // pub/sub invalidation signal (e.g. pg NOTIFY) if needed.
    let cache: CurrencyCache | null = null;

    async function warmCache() {
        if (cache) return cache;
        const rows = await db.select().from(schema.currencies);
        cache = {
            byId: new Map(rows.map((c) => [c.id, c])),
            byCode: new Map(rows.map((c) => [c.code, c])),
        };
        log.debug("currencies cache warmed", { count: rows.length });
        return cache;
    }

    function invalidateCache() {
        cache = null;
    }

    async function list(pagination?: PaginationInput): Promise<PaginatedList<Currency>> {
        const { limit, offset } = PaginationInputSchema.parse(pagination ?? {});

        const c = await warmCache();
        const all = [...c.byId.values()];

        return {
            data: all.slice(offset, offset + limit),
            total: all.length,
            limit,
            offset,
        };
    }

    async function findById(id: string) {
        const c = await warmCache();
        const currency = c.byId.get(id);

        if (!currency) throw new CurrencyNotFoundError(id);

        return currency;
    }

    async function findByCode(code: string) {
        const c = await warmCache();
        const currency = c.byCode.get(code.toUpperCase());

        if (!currency) throw new CurrencyNotFoundError(code);

        return currency;
    }

    async function create(input: CurrencyInsert) {
        const validated = CreateCurrencyInputSchema.parse(input);

        const [row] = await db
            .insert(schema.currencies)
            .values(validated)
            .returning();

        invalidateCache();

        return row!;
    }

    async function update(
        id: string,
        input: UpdateCurrencyInput,
    ) {
        const validated = UpdateCurrencyInputSchema.parse(input);

        const [row] = await db
            .update(schema.currencies)
            .set(validated)
            .where(eq(schema.currencies.id, id))
            .returning();

        if (!row) throw new CurrencyNotFoundError(id);
        invalidateCache();

        return row;
    }

    return {
        list,
        findById,
        findByCode,
        create,
        update,
    };
}
