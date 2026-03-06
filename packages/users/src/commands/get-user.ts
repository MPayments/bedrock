import { desc, eq } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

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
        const [row] = await db
            .select()
            .from(schema.user)
            .where(eq(schema.user.id, id))
            .limit(1);

        if (!row) {
            throw new UserNotFoundError(id);
        }

        const [lastSession] = await db
            .select({
                createdAt: schema.session.createdAt,
                ipAddress: schema.session.ipAddress,
            })
            .from(schema.session)
            .where(eq(schema.session.userId, id))
            .orderBy(desc(schema.session.createdAt))
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
