import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { session, twoFactor, user } from "./schema/auth-schema";
import { userAccessStates } from "./schema/business-schema";
import type {
  IamUserRecord,
  IamUsersReads,
  ListIamUsersInput,
} from "../../application/users/ports";

const SORT_COLUMN_MAP = {
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
} as const;

function createTwoFactorUsersSubquery(db: Queryable) {
  return db
    .select({ userId: twoFactor.userId })
    .from(twoFactor)
    .groupBy(twoFactor.userId)
    .as("two_factor_users");
}

function createUserSelectFields(
  twoFactorUsers: ReturnType<typeof createTwoFactorUsersSubquery>,
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role,
    banned: sql<boolean>`coalesce(${userAccessStates.banned}, false)`,
    banReason: userAccessStates.banReason,
    banExpires: userAccessStates.banExpires,
    twoFactorEnabled: sql<boolean>`case when ${twoFactorUsers.userId} is not null then true else false end`,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildUserListWhere(input: ListIamUsersInput) {
  const conditions: SQL[] = [];

  if (input.name) {
    conditions.push(ilike(user.name, `%${input.name}%`));
  }

  if (input.email) {
    conditions.push(ilike(user.email, `%${input.email}%`));
  }

  if (input.roles?.length) {
    conditions.push(inArray(user.role, input.roles));
  }

  if (input.banned !== undefined) {
    conditions.push(
      input.banned
        ? eq(userAccessStates.banned, true)
        : sql`coalesce(${userAccessStates.banned}, false) = false`,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

async function findUserByCondition(db: Queryable, condition: SQL) {
  const twoFactorUsers = createTwoFactorUsersSubquery(db);
  const [row] = await db
    .select(createUserSelectFields(twoFactorUsers))
    .from(user)
    .leftJoin(userAccessStates, eq(userAccessStates.userId, user.id))
    .leftJoin(twoFactorUsers, eq(twoFactorUsers.userId, user.id))
    .where(condition)
    .limit(1);

  return row ?? null;
}

export class DrizzleIamUsersReads implements IamUsersReads {
  constructor(private readonly db: Queryable) {}

  async listUsers(
    input: ListIamUsersInput,
  ): Promise<PaginatedList<IamUserRecord>> {
    const where = buildUserListWhere(input);
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      input.sortBy,
      SORT_COLUMN_MAP,
      user.createdAt,
    );
    const twoFactorUsers = createTwoFactorUsersSubquery(this.db);

    const [rows, countRows] = await Promise.all([
      this.db
        .select(createUserSelectFields(twoFactorUsers))
        .from(user)
        .leftJoin(userAccessStates, eq(userAccessStates.userId, user.id))
        .leftJoin(twoFactorUsers, eq(twoFactorUsers.userId, user.id))
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(user)
        .leftJoin(userAccessStates, eq(userAccessStates.userId, user.id))
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async getUserWithLastSession(userId: string) {
    const foundUser = await findUserByCondition(this.db, eq(user.id, userId));

    if (!foundUser) {
      return null;
    }

    const [lastSession] = await this.db
      .select({
        createdAt: session.createdAt,
        ipAddress: session.ipAddress,
      })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt))
      .limit(1);

    return {
      user: foundUser,
      lastSessionAt: lastSession?.createdAt ?? null,
      lastSessionIp: lastSession?.ipAddress ?? null,
    };
  }
}
