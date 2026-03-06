import { and, eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";

import { schema } from "@bedrock/db/schema";

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

        const [account] = await db
            .select({ id: schema.account.id, password: schema.account.password })
            .from(schema.account)
            .where(
                and(
                    eq(schema.account.userId, userId),
                    eq(schema.account.providerId, "credential"),
                ),
            )
            .limit(1);

        if (!account || !account.password) {
            throw new UserNotFoundError(userId);
        }

        const valid = await verifyPassword({
            hash: account.password,
            password: validated.currentPassword,
        });

        if (!valid) {
            throw new InvalidPasswordError();
        }

        const passwordHash = await hashPassword(validated.newPassword);

        await db
            .update(schema.account)
            .set({ password: passwordHash })
            .where(eq(schema.account.id, account.id));

        log.info("User changed own password", { userId });
    };
}
