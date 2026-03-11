import { randomUUID } from "node:crypto";

import { ExecutionContextToken, defineProvider, token, type Provider } from "@bedrock/core";

import type { CorrelationContext } from "../common/correlation";

export type RequestContext = CorrelationContext & {
  requestId: string | null;
  correlationId: string | null;
  idempotencyKey: string | null;
};

export const RequestContextToken = token<RequestContext>(
  "multihansa.request-context",
);

function readHeader(value: string | undefined | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function createRequestContextProvider(): Provider<RequestContext> {
  return defineProvider({
    provide: RequestContextToken,
    scope: "request",
    deps: {
      executionContext: ExecutionContextToken,
    },
    useFactory: ({ executionContext }) => {
      const headers = executionContext.http?.request.headers ?? {};
      const requestId = readHeader(headers["x-request-id"]) ?? randomUUID();
      const correlationId = readHeader(headers["x-correlation-id"]) ?? requestId;

      return {
        requestId,
        correlationId,
        traceId: readHeader(headers["x-trace-id"]),
        causationId: readHeader(headers["x-causation-id"]),
        idempotencyKey: readHeader(headers["idempotency-key"]),
      };
    },
  });
}
