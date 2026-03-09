import type { MiddlewareHandler } from "hono";

import type { AppContext } from "../context";
import type { AuthVariables } from "./auth";

export function createModuleGuard(
  ctx: AppContext,
  moduleId: string,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const bookId = c.req.query("bookId") || undefined;

    const effective = await ctx.moduleRuntime.getEffectiveModuleState({
      moduleId,
      bookId,
    });

    if (effective.state === "disabled") {
      c.header("Retry-After", String(effective.retryAfterSec));
      return c.json(
        {
          error: "Module disabled",
          code: "MODULE_DISABLED",
          moduleId,
          scope: effective.scope,
          effectiveState: effective.state,
          dependencyChain: effective.dependencyChain,
          retryAfterSec: effective.retryAfterSec,
          reason: effective.reason,
        },
        503,
      );
    }

    await next();
  };
}
