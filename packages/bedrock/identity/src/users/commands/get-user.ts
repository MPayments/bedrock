import { desc, eq } from "drizzle-orm";

import { session, user } from "@bedrock/identity/schema";

import { UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import type { User, UserRole } from "../validation";

export interface UserWithLastSession extends User {
  lastSessionAt: Date | null;
  lastSessionIp: string | null;
}

export function createGetUserHandler(context: UsersServiceContext) {
  const { db } = context;

  return async function getUser(id: string): Promise<UserWithLastSession> {
    const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);

    if (!row) {
      throw new UserNotFoundError(id);
    }

    const [lastSession] = await db
      .select({
        createdAt: session.createdAt,
        ipAddress: session.ipAddress,
      })
      .from(session)
      .where(eq(session.userId, id))
      .orderBy(desc(session.createdAt))
      .limit(1);

    return {
      ...row,
      role: row.role as UserRole | null,
      banned: row.banned ?? false,
      banExpires: row.banExpires ?? null,
      lastSessionAt: lastSession?.createdAt ?? null,
      lastSessionIp: lastSession?.ipAddress ?? null,
    };
  };
}
