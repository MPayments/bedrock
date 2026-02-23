import type { MiddlewareHandler } from "hono";

import auth, { type ResourcePermissions } from "@bedrock/auth";

import type { AuthVariables } from "./auth";

export function requirePermission(
    permissions: ResourcePermissions,
): MiddlewareHandler<{ Variables: AuthVariables }> {
    return async (c, next) => {
        const user = c.get("user")!;

        try {
            const result = await auth.api.userHasPermission({
                body: {
                    userId: user.id,
                    permissions,
                },
            });

            if (!result.success) {
                return c.json({ error: "Forbidden" }, 403);
            }
        } catch {
            return c.json({ error: "Forbidden" }, 403);
        }

        await next();
    };
}
