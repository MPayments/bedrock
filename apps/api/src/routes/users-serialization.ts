import { z } from "@hono/zod-openapi";

import { UserSchema, type User, type UserWithLastSession } from "@bedrock/users";

export const SerializedUserSchema = UserSchema.extend({
    banExpires: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export const SerializedUserWithLastSessionSchema = SerializedUserSchema.extend({
    lastSessionAt: z.string().nullable(),
    lastSessionIp: z.string().nullable(),
});

export function serializeUser(user: User) {
    return {
        ...user,
        banExpires: user.banExpires?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    };
}

export function serializeUserWithSession(user: UserWithLastSession) {
    return {
        ...serializeUser(user),
        lastSessionAt: user.lastSessionAt?.toISOString() ?? null,
        lastSessionIp: user.lastSessionIp,
    };
}
