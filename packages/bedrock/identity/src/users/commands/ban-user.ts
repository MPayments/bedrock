import { eq, sql } from "drizzle-orm";

import { session, user } from "@bedrock/identity/schema";

import { UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import {
  BanUserInputSchema,
  type BanUserInput,
  type User,
  type UserRole,
} from "../validation";

export function createBanUserHandler(context: UsersServiceContext) {
  const { db, log } = context;

  return async function banUser(
    id: string,
    input: BanUserInput,
  ): Promise<User> {
    const validated = BanUserInputSchema.parse(input);

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(user)
        .set({
          banned: true,
          banReason: validated.banReason ?? null,
          banExpires: validated.banExpires ?? null,
          updatedAt: sql`now()`,
        })
        .where(eq(user.id, id))
        .returning();

      if (!updated) {
        throw new UserNotFoundError(id);
      }

      await tx.delete(session).where(eq(session.userId, id));

      log.info("User banned", { id, reason: validated.banReason });

      return {
        ...updated,
        role: updated.role as UserRole | null,
        banned: updated.banned ?? false,
        banExpires: updated.banExpires ?? null,
      };
    });
  };
}

export function createUnbanUserHandler(context: UsersServiceContext) {
  const { db, log } = context;

  return async function unbanUser(id: string): Promise<User> {
    const [updated] = await db
      .update(user)
      .set({
        banned: false,
        banReason: null,
        banExpires: null,
        updatedAt: sql`now()`,
      })
      .where(eq(user.id, id))
      .returning();

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User unbanned", { id });

    return {
      ...updated,
      role: updated.role as UserRole | null,
      banned: updated.banned ?? false,
      banExpires: updated.banExpires ?? null,
    };
  };
}
