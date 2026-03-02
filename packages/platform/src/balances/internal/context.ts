import type { Database } from "@bedrock/foundation/db/types";
import { noopLogger, type Logger } from "@bedrock/foundation/kernel";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/platform/idempotency";

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
