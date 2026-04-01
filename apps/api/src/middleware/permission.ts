import type { MiddlewareHandler } from "hono";

import * as authModule from "../auth";
import type { ResourcePermissions } from "../auth";
import type { AuthVariables } from "./auth";

type PermissionAuthSurface = {
  api: {
    userHasPermission: (input: {
      body: {
        permissions: ResourcePermissions;
        userId: string;
      };
    }) => Promise<{ success: boolean }>;
  };
};

function resolveAuthSurface(
  audience: AuthVariables["audience"],
): PermissionAuthSurface {
  if (Reflect.has(authModule, "authByAudience")) {
    const byAudience = Reflect.get(authModule, "authByAudience") as Record<
      string,
      PermissionAuthSurface
    >;
    const surface = byAudience[audience ?? "crm"] ?? byAudience.crm;
    if (surface) {
      return surface;
    }
  }

  if (Reflect.has(authModule, "default")) {
    return Reflect.get(authModule, "default") as PermissionAuthSurface;
  }

  throw new Error("Auth surface not configured");
}

export function requirePermission(
    permissions: ResourcePermissions,
): MiddlewareHandler<{ Variables: AuthVariables }> {
    return async (c, next) => {
        const user = c.get("user")!;
        const auth = resolveAuthSurface(c.get("audience"));

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
