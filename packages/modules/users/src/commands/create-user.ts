import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { account, user } from "@bedrock/auth/schema";

import { UserEmailConflictError } from "../errors";
import type { UsersServiceContext } from "../internal/context";
import {
    CreateUserInputSchema,
    type CreateUserInput,
    type User,
    type UserRole,
} from "../validation";

export function createCreateUserHandler(context: UsersServiceContext) {
    const { db, log } = context;

    return async function createUser(input: CreateUserInput): Promise<User> {
        const validated = CreateUserInputSchema.parse(input);

        return db.transaction(async (tx) => {
            const [existing] = await tx
                .select({ id: user.id })
                .from(user)
                .where(eq(user.email, validated.email))
                .limit(1);

            if (existing) {
                throw new UserEmailConflictError(validated.email);
            }

            const userId = crypto.randomUUID();
            const now = new Date();
            const passwordHash = await hashPassword(validated.password);

            const [created] = await tx
                .insert(user)
                .values({
                    id: userId,
                    name: validated.name,
                    email: validated.email,
                    emailVerified: true,
                    role: validated.role,
                    createdAt: now,
                    updatedAt: now,
                })
                .returning();

            await tx.insert(account).values({
                id: crypto.randomUUID(),
                accountId: userId,
                providerId: "credential",
                userId,
                password: passwordHash,
                createdAt: now,
                updatedAt: now,
            });

            log.info("User created", { id: created!.id, email: created!.email });

            return {
                ...created!,
                role: created!.role as UserRole | null,
                banned: created!.banned ?? false,
                banExpires: created!.banExpires ?? null,
            };
        });
    };
}
