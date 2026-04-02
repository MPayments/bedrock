import { and, eq } from "drizzle-orm";

import type { Database } from "../client";
import { schema } from "../schema-registry";

export type HashPasswordFn = (password: string) => Promise<string>;

export const USER_IDS = {
    ADMIN: "00000000-0000-4000-8000-000000000901",
    FINANCE: "00000000-0000-4000-8000-000000000902",
} as const;

const ACCOUNT_IDS = {
    ADMIN: "00000000-0000-4000-8000-000000000911",
    FINANCE: "00000000-0000-4000-8000-000000000912",
} as const;

interface UserSeed {
    id: string;
    accountId: string;
    name: string;
    email: string;
    role: string;
    password: string;
}

const USER_SEEDS: UserSeed[] = [
    {
        id: USER_IDS.ADMIN,
        accountId: ACCOUNT_IDS.ADMIN,
        name: "Admin",
        email: "admin@bedrock.com",
        role: "admin",
        password: "admin123",
    },
    {
        id: USER_IDS.FINANCE,
        accountId: ACCOUNT_IDS.FINANCE,
        name: "Finance",
        email: "finance@bedrock.com",
        role: "finance",
        password: "finance123",
    },
];

export async function seedUsers(db: Database, hashPassword: HashPasswordFn): Promise<void> {
    const created: { email: string; password: string }[] = [];

    for (const seed of USER_SEEDS) {
        const now = new Date();
        const [existingById] = await db
            .select({ email: schema.user.email, id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.id, seed.id))
            .limit(1);
        const [existingByEmail] = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .where(eq(schema.user.email, seed.email))
            .limit(1);
        const [existingCredential] = await db
            .select({ id: schema.account.id })
            .from(schema.account)
            .where(
                and(
                    eq(schema.account.providerId, "credential"),
                    eq(schema.account.userId, seed.id),
                ),
            )
            .limit(1);
        const passwordHash = await hashPassword(seed.password);

        if (existingByEmail && existingByEmail.id !== seed.id && !existingById) {
            throw new Error(
                `User id mismatch for ${seed.email}: expected ${seed.id}, got ${existingByEmail.id}`,
            );
        }

        if (existingById) {
            await db.update(schema.user).set({
                email: seed.email,
                emailVerified: true,
                name: seed.name,
                role: seed.role,
                updatedAt: now,
            }).where(eq(schema.user.id, seed.id));

            await db.insert(schema.userAccessStates).values({
                userId: seed.id,
                banned: false,
                banReason: null,
                banExpires: null,
                createdAt: now,
                updatedAt: now,
            }).onConflictDoUpdate({
                target: schema.userAccessStates.userId,
                set: {
                    banned: false,
                    banReason: null,
                    banExpires: null,
                    updatedAt: now,
                },
            });

            if (seed.role === "admin" || seed.role === "agent") {
                await db.insert(schema.agentProfiles).values({
                    userId: seed.id,
                    status: "active",
                    isAllowed: false,
                    createdAt: now,
                    updatedAt: now,
                }).onConflictDoNothing();
            }

            if (existingCredential) {
                await db.update(schema.account).set({
                    accountId: seed.id,
                    password: passwordHash,
                    updatedAt: now,
                }).where(eq(schema.account.id, existingCredential.id));
            } else {
                await db.insert(schema.account).values({
                    id: seed.accountId,
                    accountId: seed.id,
                    providerId: "credential",
                    userId: seed.id,
                    password: passwordHash,
                    createdAt: now,
                    updatedAt: now,
                });
            }

            continue;
        }

        await db.insert(schema.user).values({
            id: seed.id,
            name: seed.name,
            email: seed.email,
            emailVerified: true,
            role: seed.role,
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(schema.account).values({
            id: seed.accountId,
            accountId: seed.id,
            providerId: "credential",
            userId: seed.id,
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(schema.userAccessStates).values({
            userId: seed.id,
            banned: false,
            banReason: null,
            banExpires: null,
            createdAt: now,
            updatedAt: now,
        }).onConflictDoUpdate({
            target: schema.userAccessStates.userId,
            set: {
                banned: false,
                banReason: null,
                banExpires: null,
                updatedAt: now,
            },
        });

        if (seed.role === "admin" || seed.role === "agent") {
            await db.insert(schema.agentProfiles).values({
                userId: seed.id,
                status: "active",
                isAllowed: false,
                createdAt: now,
                updatedAt: now,
            });
        }

        created.push({ email: seed.email, password: seed.password });
    }

    if (created.length > 0) {
        console.log("\n┌─────────────────────────────────────────┐");
        console.log("│          Seeded user credentials         │");
        console.log("├──────────────────────┬──────────────────┤");
        for (const { email, password } of created) {
            console.log(`│ ${email.padEnd(20)} │ ${password.padEnd(16)} │`);
        }
        console.log("└──────────────────────┴──────────────────┘\n");
    }
}
