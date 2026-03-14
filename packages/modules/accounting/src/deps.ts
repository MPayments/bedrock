import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type { AccountingPackDefinition } from "./packs/schema";

export interface AccountingRuntimeDeps {
  db?: Database;
  defaultPackDefinition: AccountingPackDefinition;
}

export interface AccountingServiceDeps extends AccountingRuntimeDeps {
  db: Database;
  logger?: Logger;
}
