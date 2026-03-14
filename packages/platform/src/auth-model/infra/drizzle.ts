import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type { Database, Transaction } from "../../persistence/drizzle";
import {
  account,
  session,
  user,
  type AuthBanUserInput,
  type AuthCreateUserWithCredentialInput,
  type AuthIdentityStorePort,
  type AuthListUsersInput,
  type AuthUpdateUserInput,
  type AuthUserRecord,
  type AuthUserWithLastSession,
} from "../index";

const SORT_COLUMN_MAP = {
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
} as const;

export interface AuthIdentityStoreDeps {
  db: Database;
}

function buildUserListWhere(input: AuthListUsersInput): SQL | undefined {
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
    conditions.push(eq(user.banned, input.banned));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function createDrizzleAuthIdentityStore(
  deps: AuthIdentityStoreDeps,
): AuthIdentityStorePort {
  const { db } = deps;

  async function listUsers(
    input: AuthListUsersInput,
  ): Promise<PaginatedList<AuthUserRecord>> {
    const where = buildUserListWhere(input);
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      input.sortBy,
      SORT_COLUMN_MAP,
      user.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      db
        .select()
        .from(user)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(input.limit)
        .offset(input.offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(user)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async function findUserById(id: string): Promise<AuthUserRecord | null> {
    const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    return row ?? null;
  }

  async function findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const [row] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    return row ?? null;
  }

  async function createUserWithCredential(
    input: AuthCreateUserWithCredentialInput,
  ): Promise<AuthUserRecord> {
    const now = input.now ?? new Date();
    const userId = crypto.randomUUID();

    return db.transaction(async (tx: Transaction) => {
      const [created] = await tx
        .insert(user)
        .values({
          id: userId,
          name: input.name,
          email: input.email,
          emailVerified: input.emailVerified ?? true,
          role: input.role ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: input.passwordHash,
        createdAt: now,
        updatedAt: now,
      });

      return created!;
    });
  }

  async function updateUser(
    input: AuthUpdateUserInput,
  ): Promise<AuthUserRecord | null> {
    const fields: Partial<
      Pick<typeof user.$inferInsert, "name" | "email" | "role">
    > = {};

    if (input.name !== undefined) {
      fields.name = input.name;
    }
    if (input.email !== undefined) {
      fields.email = input.email;
    }
    if (input.role !== undefined) {
      fields.role = input.role;
    }

    const [updated] = await db
      .update(user)
      .set({ ...fields, updatedAt: sql`now()` })
      .where(eq(user.id, input.id))
      .returning();

    return updated ?? null;
  }

  async function getCredentialByUserId(userId: string) {
    const [credential] = await db
      .select({
        id: account.id,
        userId: account.userId,
        providerId: account.providerId,
        password: account.password,
      })
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, "credential"),
        ),
      )
      .limit(1);

    return credential ?? null;
  }

  async function updateCredentialPassword(input: {
    userId: string;
    passwordHash: string;
  }) {
    const [updated] = await db
      .update(account)
      .set({ password: input.passwordHash, updatedAt: sql`now()` })
      .where(
        and(
          eq(account.userId, input.userId),
          eq(account.providerId, "credential"),
        ),
      )
      .returning({
        id: account.id,
        userId: account.userId,
        providerId: account.providerId,
        password: account.password,
      });

    return updated ?? null;
  }

  async function deleteSessionsForUser(userId: string): Promise<void> {
    await db.delete(session).where(eq(session.userId, userId));
  }

  async function getUserWithLastSession(
    userId: string,
  ): Promise<AuthUserWithLastSession | null> {
    const [row] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!row) {
      return null;
    }

    const [lastSession] = await db
      .select({
        createdAt: session.createdAt,
        ipAddress: session.ipAddress,
      })
      .from(session)
      .where(eq(session.userId, userId))
      .orderBy(desc(session.createdAt))
      .limit(1);

    return {
      user: row,
      lastSessionAt: lastSession?.createdAt ?? null,
      lastSessionIp: lastSession?.ipAddress ?? null,
    };
  }

  async function banUser(
    input: AuthBanUserInput,
  ): Promise<AuthUserRecord | null> {
    return db.transaction(async (tx: Transaction) => {
      const [updated] = await tx
        .update(user)
        .set({
          banned: true,
          banReason: input.banReason ?? null,
          banExpires: input.banExpires ?? null,
          updatedAt: sql`now()`,
        })
        .where(eq(user.id, input.id))
        .returning();

      if (!updated) {
        return null;
      }

      await tx.delete(session).where(eq(session.userId, input.id));
      return updated;
    });
  }

  async function unbanUser(userId: string): Promise<AuthUserRecord | null> {
    const [updated] = await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: sql`now()`,
      })
      .where(eq(user.id, userId))
      .returning();

    return updated ?? null;
  }

  return {
    listUsers,
    findUserById,
    findUserByEmail,
    createUserWithCredential,
    updateUser,
    getCredentialByUserId,
    updateCredentialPassword,
    deleteSessionsForUser,
    getUserWithLastSession,
    banUser,
    unbanUser,
  };
}
