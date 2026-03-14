import type { Logger } from "@bedrock/platform-observability/logger";
import type { Database } from "@bedrock/platform-persistence";
import { noopLogger } from "@bedrock/platform-observability/logger";

import type { AccountingPackDefinition } from "../../packs/schema";

export interface AccountingRuntimeDeps {
  db?: Database;
  defaultPackDefinition: AccountingPackDefinition;
}

export interface AccountingServiceDeps extends AccountingRuntimeDeps {
  db: Database;
  logger?: Logger;
}

interface AccountingServiceContext {
  db: Database;
  log: Logger;
}

export function createAccountingServiceContext(
  deps: AccountingServiceDeps,
): AccountingServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "accounting" }) ?? noopLogger,
  };
}
