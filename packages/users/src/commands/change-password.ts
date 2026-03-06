import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import {
    ChangePasswordInputSchema,
    type ChangePasswordInput,
} from "../validation";

export function createChangePasswordHandler(context: UsersServiceContext) {
    const { db, log } = context;

    return async function changePassword(
        userId: string,
        input: ChangePasswordInput,
    ): Promise<void> {
        const validated = ChangePasswordInputSchema.parse(input);

        const [user] = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.id, userId))
            .limit(1);

        if (!user) {
            throw new UserNotFoundError(userId);
        }

        const passwordHash = await hashPassword(validated.newPassword);

        const [updated] = await db
            .update(schema.account)
            .set({ password: passwordHash })
            .where(
                and(
                    eq(schema.account.userId, userId),
                    eq(schema.account.providerId, "credential"),
                ),
            )
            .returning({ id: schema.account.id });

        if (!updated) {
            throw new UserNotFoundError(userId);
        }

        log.info("User password changed", { userId });
    };
}
