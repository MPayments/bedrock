import type { Database } from "@bedrock/foundation/db/types";
import { noopLogger, type Logger } from "@bedrock/foundation/kernel";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/idempotency";

import type { ConnectorAdapter, ConnectorsServiceDeps } from "../types";

export interface ConnectorsServiceContext {
  db: Database;
  idempotency: IdempotencyService;
  providers: Record<string, ConnectorAdapter>;
  log: Logger;
}

export function createConnectorsServiceContext(
  deps: ConnectorsServiceDeps,
): ConnectorsServiceContext {
  return {
    db: deps.db,
    idempotency: createIdempotencyService({ logger: deps.logger }),
    providers: deps.providers ?? {},
    log: deps.logger?.child({ svc: "connectors" }) ?? noopLogger,
  };
}
