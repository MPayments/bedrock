import type { MiddlewareHandler } from "hono";

import auth from "@bedrock/auth";

import type { AuthVariables } from "./auth";

type ResourcePermissions = Record<string, string[]>;

export function requirePermission(
    permissions: ResourcePermissions,
): MiddlewareHandler<{ Variables: AuthVariables }> {
    return async (c, next) => {
        const user = c.get("user")!;

        try {
            const result = await auth.api.userHasPermission({
                body: {
                    userId: user.id,
                    permission: permissions
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
