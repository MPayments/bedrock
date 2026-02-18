import type { MiddlewareHandler } from "hono";
import auth from "@bedrock/auth";

export type AuthVariables = {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
};

export const authMiddleware = (): MiddlewareHandler<{
    Variables: AuthVariables;
}> => {
    return async (c, next) => {
        const authSession = await auth.api.getSession({
            headers: c.req.raw.headers,
        });

        if (!authSession) {
            c.set("user", null);
            c.set("session", null);
            await next();
            return;
        }

        c.set("user", authSession.user);
        c.set("session", authSession.session);
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