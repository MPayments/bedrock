import { noopLogger, type Logger } from "@bedrock/common";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/operations";
import type { Database } from "@bedrock/sql/ports";

export interface BalancesServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface BalancesServiceContext {
  db: Database;
  idempotency: IdempotencyService;
  log: Logger;
}

export function createBalancesServiceContext(
  deps: BalancesServiceDeps,
): BalancesServiceContext {
  return {
    db: deps.db,
    idempotency: createIdempotencyService({ logger: deps.logger }),
    log: deps.logger?.child({ svc: "balances" }) ?? noopLogger,
  };
}
