import { noopLogger, type Logger } from "@bedrock/kernel/logger";

export interface IdempotencyServiceDeps {
  logger?: Logger;
}

export interface IdempotencyServiceContext {
  log: Logger;
}

export function createIdempotencyServiceContext(
  deps: IdempotencyServiceDeps,
): IdempotencyServiceContext {
  return {
    log: deps.logger?.child({ svc: "idempotency" }) ?? noopLogger,
  };
}
