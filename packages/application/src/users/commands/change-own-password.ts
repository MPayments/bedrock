import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { account as authAccount } from "@bedrock/application/auth/schema";

import { InvalidPasswordError, UserNotFoundError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import {
    ChangeOwnPasswordInputSchema,
    type ChangeOwnPasswordInput,
} from "../validation";

export function createChangeOwnPasswordHandler(context: UsersServiceContext) {
    const { db, log } = context;

    return async function changeOwnPassword(
        userId: string,
        input: ChangeOwnPasswordInput,
    ): Promise<void> {
        const validated = ChangeOwnPasswordInputSchema.parse(input);

        const [credentialAccount] = await db
            .select({ id: authAccount.id, password: authAccount.password })
            .from(authAccount)
            .where(
                and(
                    eq(authAccount.userId, userId),
                    eq(authAccount.providerId, "credential"),
                ),
            )
            .limit(1);

        if (!credentialAccount || !credentialAccount.password) {
            throw new UserNotFoundError(userId);
        }

        const valid = await verifyPassword({
            hash: credentialAccount.password,
            password: validated.currentPassword,
        });

        if (!valid) {
            throw new InvalidPasswordError();
        }

        const passwordHash = await hashPassword(validated.newPassword);

        await db
            .update(authAccount)
            .set({ password: passwordHash })
            .where(eq(authAccount.id, credentialAccount.id));

        log.info("User changed own password", { userId });
    };
}
