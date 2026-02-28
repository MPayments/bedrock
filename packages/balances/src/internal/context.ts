import type { Database } from "@bedrock/db";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/idempotency";
import { noopLogger, type Logger } from "@bedrock/kernel";

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
