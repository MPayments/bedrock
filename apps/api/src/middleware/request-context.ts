import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";

import type { CorrelationContext } from "@bedrock/foundation/kernel";

import type { AuthVariables } from "./auth";

export interface RequestContext extends CorrelationContext {
  requestId: string | null;
  correlationId: string | null;
  idempotencyKey: string | null;
}

function readHeader(value: string | undefined | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function requestContextMiddleware(): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    const requestId =
      readHeader(c.req.header("x-request-id")) ?? randomUUID();
    const correlationId =
      readHeader(c.req.header("x-correlation-id")) ?? requestId;
    const traceId = readHeader(c.req.header("x-trace-id"));
    const causationId = readHeader(c.req.header("x-causation-id"));
    const idempotencyKey = readHeader(c.req.header("idempotency-key"));

    c.set("requestContext", {
      requestId,
      correlationId,
      traceId,
      causationId,
      idempotencyKey,
    });

    await next();
  };
}
