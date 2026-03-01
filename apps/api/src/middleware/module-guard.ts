import type { MiddlewareHandler } from "hono";

import type { BedrockComponentId } from "@bedrock/component-runtime";

import type { AppContext } from "../context";
import type { AuthVariables } from "./auth";

export function createComponentGuard(
  ctx: AppContext,
  componentId: BedrockComponentId,
): MiddlewareHandler<{ Variables: AuthVariables }> {
  return async (c, next) => {
    const bookId = c.req.query("bookId") || undefined;

    const effective = await ctx.componentRuntime.getEffectiveComponentState({
      componentId,
      bookId,
    });

    if (effective.state === "disabled") {
      c.header("Retry-After", String(effective.retryAfterSec));
      return c.json(
        {
          error: "Component disabled",
          code: "COMPONENT_DISABLED",
          componentId,
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
