import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import {
    type PaginatedList,
    resolveSortOrder,
    resolveSortValue,
} from "@bedrock/kernel/pagination";

import type { UsersServiceContext } from "../internal/context";
import {
    ListUsersQuerySchema,
    UserRoleSchema,
    type ListUsersQuery,
    type User,
    type UserRole,
} from "../validation";

const SORT_COLUMN_MAP = {
    name: schema.user.name,
    email: schema.user.email,
    role: schema.user.role,
    createdAt: schema.user.createdAt,
} as const;

export function createListUsersHandler(context: UsersServiceContext) {
    const { db } = context;

    return async function listUsers(
        input?: ListUsersQuery,
    ): Promise<PaginatedList<User>> {
        const query = ListUsersQuerySchema.parse(input ?? {});
        const { limit, offset, sortBy, sortOrder, name, email, role, banned } =
            query;

        const conditions: SQL[] = [];

        if (name) {
            conditions.push(ilike(schema.user.name, `%${name}%`));
        }

        if (email) {
            conditions.push(ilike(schema.user.email, `%${email}%`));
        }

        const roles = role?.map((v) => UserRoleSchema.parse(v));
        if (roles?.length) {
            conditions.push(inArray(schema.user.role, roles));
        }

        if (banned !== undefined) {
            conditions.push(eq(schema.user.banned, banned));
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
        const orderByCol = resolveSortValue(
            sortBy,
            SORT_COLUMN_MAP,
            schema.user.createdAt,
        );

        const [rows, countRows] = await Promise.all([
            db
                .select()
                .from(schema.user)
                .where(where)
                .orderBy(orderByFn(orderByCol))
                .limit(limit)
                .offset(offset),
            db
                .select({ total: sql<number>`count(*)::int` })
                .from(schema.user)
                .where(where),
        ]);

        return {
            data: rows.map((row) => ({
                ...row,
                role: row.role as UserRole | null,
                banned: row.banned ?? false,
                banExpires: row.banExpires ?? null,
            })),
            total: countRows[0]?.total ?? 0,
            limit,
            offset,
        };
    };
}
