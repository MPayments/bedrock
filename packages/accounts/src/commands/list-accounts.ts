import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import {
    type PaginatedList,
    resolveSortOrder,
    resolveSortValue,
} from "@bedrock/kernel/pagination";

import type { AccountServiceContext } from "../internal/context";
import {
    ListAccountsQuerySchema,
    type ListAccountsQuery,
} from "../validation";

const SORT_COLUMN_MAP = {
    label: schema.accounts.label,
    createdAt: schema.accounts.createdAt,
} as const;

type AccountRow = typeof schema.accounts.$inferSelect;

export function createListAccountsHandler(context: AccountServiceContext) {
    const { db } = context;

    return async function listAccounts(
        input?: ListAccountsQuery,
    ): Promise<PaginatedList<AccountRow>> {
        const query = ListAccountsQuerySchema.parse(input ?? {});
        const { limit, offset, sortBy, sortOrder, counterpartyId, currencyId, accountProviderId } = query;

        const conditions: SQL[] = [];

        if (counterpartyId) {
            conditions.push(eq(schema.accounts.counterpartyId, counterpartyId));
        }

        if (currencyId) {
            conditions.push(eq(schema.accounts.currencyId, currencyId));
        }

        if (accountProviderId) {
            conditions.push(eq(schema.accounts.accountProviderId, accountProviderId));
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
        const orderByCol = resolveSortValue(sortBy, SORT_COLUMN_MAP, schema.accounts.createdAt);

        const [rows, countRows] = await Promise.all([
            db
                .select()
                .from(schema.accounts)
                .where(where)
                .orderBy(orderByFn(orderByCol))
                .limit(limit)
                .offset(offset),
            db
                .select({ total: sql<number>`count(*)::int` })
                .from(schema.accounts)
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
