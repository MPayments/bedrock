import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import {
  type PaginatedList,
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/common/pagination";
import { user } from "@bedrock/identity/schema";

import type { UsersServiceContext } from "../internal/context";
import {
  ListUsersQuerySchema,
  UserRoleSchema,
  type ListUsersQuery,
  type User,
  type UserRole,
} from "../validation";

const SORT_COLUMN_MAP = {
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
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
      conditions.push(ilike(user.name, `%${name}%`));
    }

    if (email) {
      conditions.push(ilike(user.email, `%${email}%`));
    }

    const roles = role?.map((v) => UserRoleSchema.parse(v));
    if (roles?.length) {
      conditions.push(inArray(user.role, roles));
    }

    if (banned !== undefined) {
      conditions.push(eq(user.banned, banned));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      sortBy,
      SORT_COLUMN_MAP,
      user.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(user)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(user)
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
