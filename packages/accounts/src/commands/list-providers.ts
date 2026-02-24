import { and, asc, desc, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import {
    type PaginatedList,
    resolveSortOrder,
    resolveSortValue,
} from "@bedrock/kernel/pagination";

import type { AccountServiceContext } from "../internal/context";
import {
    ListProvidersQuerySchema,
    type AccountProviderType,
    type ListProvidersQuery,
} from "../validation";

const SORT_COLUMN_MAP = {
    name: schema.accountProviders.name,
    type: schema.accountProviders.type,
    country: schema.accountProviders.country,
    createdAt: schema.accountProviders.createdAt,
} as const;

type AccountProviderRow = typeof schema.accountProviders.$inferSelect;

export function createListProvidersHandler(context: AccountServiceContext) {
    const { db } = context;

    return async function listProviders(
        input?: ListProvidersQuery,
    ): Promise<PaginatedList<AccountProviderRow>> {
        const query = ListProvidersQuerySchema.parse(input ?? {});
        const { limit, offset, sortBy, sortOrder, name, type, country } = query;

        const conditions: SQL[] = [];

        if (name) {
            conditions.push(ilike(schema.accountProviders.name, `%${name}%`));
        }

        if (type?.length) {
            conditions.push(inArray(schema.accountProviders.type, type as AccountProviderType[]));
        }

        if (country?.length) {
            conditions.push(inArray(schema.accountProviders.country, country));
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
        const orderByCol = resolveSortValue(sortBy, SORT_COLUMN_MAP, schema.accountProviders.createdAt);

        const [rows, countRows] = await Promise.all([
            db
                .select()
                .from(schema.accountProviders)
                .where(where)
                .orderBy(orderByFn(orderByCol))
                .limit(limit)
                .offset(offset),
            db
                .select({ total: sql<number>`count(*)::int` })
                .from(schema.accountProviders)
                .where(where),
        ]);

        return {
            data: rows,
            total: countRows[0]?.total ?? 0,
            limit,
            offset,
        };
    };
}
