import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { account as authAccount, user as authUser } from "@bedrock/identity/schema";

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

        const [existingUser] = await db
            .select({ id: authUser.id })
            .from(authUser)
            .where(eq(authUser.id, userId))
            .limit(1);

        if (!existingUser) {
            throw new UserNotFoundError(userId);
        }

        const passwordHash = await hashPassword(validated.newPassword);

        const [updated] = await db
            .update(authAccount)
            .set({ password: passwordHash })
            .where(
                and(
                    eq(authAccount.userId, userId),
                    eq(authAccount.providerId, "credential"),
                ),
            )
            .returning({ id: authAccount.id });

        if (!updated) {
            throw new UserNotFoundError(userId);
        }

        log.info("User password changed", { userId });
    };
}
