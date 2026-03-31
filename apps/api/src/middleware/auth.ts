import type { MiddlewareHandler } from "hono";

import { getValidatedSession, type AuthAudience, type AuthSession } from "../auth";
import type { RequestContext } from "./request-context";

export interface AuthVariables {
  audience: AuthAudience | null;
  user: NonNullable<AuthSession>["user"] | null;
  session: NonNullable<AuthSession>["session"] | null;
  requestContext: RequestContext;
}

export const authMiddleware = (): MiddlewareHandler<{
  Variables: AuthVariables;
}> => {
  return async (c, next) => {
    const resolved = await getValidatedSession({
      headers: c.req.raw.headers,
    });

    if (!resolved) {
      c.set("audience", null);
      c.set("user", null);
      c.set("session", null);
      await next();
      return;
    }

    c.set("audience", resolved.audience);
    c.set("user", resolved.session.user);
    c.set("session", resolved.session.session);
    await next();
  };
};

export function requireAuth(): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    if (!c.get("user")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
