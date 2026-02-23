import { eq } from "drizzle-orm";

import type { Database } from "../client";
import { user, account } from "../schema/auth";

export type HashPasswordFn = (password: string) => Promise<string>;

export const USER_IDS = {
    ADMIN: "00000000-0000-4000-8000-000000000901",
    USER: "00000000-0000-4000-8000-000000000902",
} as const;

const ACCOUNT_IDS = {
    ADMIN: "00000000-0000-4000-8000-000000000911",
    USER: "00000000-0000-4000-8000-000000000912",
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
        id: USER_IDS.USER,
        accountId: ACCOUNT_IDS.USER,
        name: "User",
        email: "user@bedrock.com",
        role: "user",
        password: "user123",
    },
];

export async function seedUsers(db: Database, hashPassword: HashPasswordFn): Promise<void> {
    const created: { email: string; password: string }[] = [];

    for (const seed of USER_SEEDS) {
        const [existing] = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, seed.email))
            .limit(1);

        if (existing) {
            if (existing.id !== seed.id) {
                throw new Error(
                    `User id mismatch for ${seed.email}: expected ${seed.id}, got ${existing.id}`,
                );
            }
            continue;
        }

        const now = new Date();
        const passwordHash = await hashPassword(seed.password);

        await db.insert(user).values({
            id: seed.id,
            name: seed.name,
            email: seed.email,
            emailVerified: true,
            role: seed.role,
            createdAt: now,
            updatedAt: now,
        });

        await db.insert(account).values({
            id: seed.accountId,
            accountId: seed.id,
            providerId: "credential",
            userId: seed.id,
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
        });

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
