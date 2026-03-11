import { noopLogger, type Logger } from "@multihansa/common";
import type { Database } from "@multihansa/common/sql/ports";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@multihansa/common/operations";

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
