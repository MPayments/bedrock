import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type { CustomerLifecycleSyncPort } from "../customer-lifecycle-port";

export interface CustomersServiceDeps {
  db: Database;
  customerLifecycleSyncPort: CustomerLifecycleSyncPort;
  logger?: Logger;
}

export interface CustomersServiceContext {
  db: Database;
  customerLifecycleSyncPort: CustomerLifecycleSyncPort;
  log: Logger;
}

export function createCustomersServiceContext(
  deps: CustomersServiceDeps,
): CustomersServiceContext {
  return {
    db: deps.db,
    customerLifecycleSyncPort: deps.customerLifecycleSyncPort,
    log: deps.logger?.child({ service: "customers" }) ?? noopLogger,
  };
}
