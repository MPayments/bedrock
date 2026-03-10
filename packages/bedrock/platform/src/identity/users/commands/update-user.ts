import { and, eq, ne, sql } from "drizzle-orm";

import { user } from "@bedrock/platform/identity/schema";

import { UserEmailConflictError, UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import {
  UpdateUserInputSchema,
  type UpdateUserInput,
  type User,
  type UserRole,
} from "../validation";

export function createUpdateUserHandler(context: UsersServiceContext) {
  const { db, log } = context;

  return async function updateUser(
    id: string,
    input: UpdateUserInput,
  ): Promise<User> {
    const validated = UpdateUserInputSchema.parse(input);

    const [existing] = await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!existing) {
      throw new UserNotFoundError(id);
    }

    if (validated.email && validated.email !== existing.email) {
      const [conflict] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.email, validated.email), ne(user.id, id)))
        .limit(1);

      if (conflict) {
        throw new UserEmailConflictError(validated.email);
      }
    }

    const fields: Partial<
      Pick<typeof user.$inferInsert, "name" | "email" | "role">
    > = {};

    if (validated.name !== undefined) fields.name = validated.name;
    if (validated.email !== undefined) fields.email = validated.email;
    if (validated.role !== undefined) fields.role = validated.role;

    if (Object.keys(fields).length === 0) {
      return {
        ...existing,
        role: existing.role as UserRole | null,
        banned: existing.banned ?? false,
        banExpires: existing.banExpires ?? null,
      };
    }

    const [updated] = await db
      .update(user)
      .set({ ...fields, updatedAt: sql`now()` })
      .where(eq(user.id, id))
      .returning();

    if (!updated) {
      throw new UserNotFoundError(id);
    }

    log.info("User updated", { id });

    return {
      ...updated,
      role: updated.role as UserRole | null,
      banned: updated.banned ?? false,
      banExpires: updated.banExpires ?? null,
    };
  };
}
