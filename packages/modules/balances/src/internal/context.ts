import type { IdempotencyPort } from "@bedrock/platform-idempotency";
import { noopLogger, type Logger } from "@bedrock/platform-observability/logger";
import type { Database } from "@bedrock/platform-persistence";

export interface BalancesServiceDeps {
  db: Database;
  idempotency: IdempotencyPort;
  logger?: Logger;
}

export interface BalancesServiceContext {
  db: Database;
  idempotency: IdempotencyPort;
  log: Logger;
}

export function createBalancesServiceContext(
  deps: BalancesServiceDeps,
): BalancesServiceContext {
  return {
    db: deps.db,
    idempotency: deps.idempotency,
    log: deps.logger?.child({ svc: "balances" }) ?? noopLogger,
  };
}
