import type { Database } from "@bedrock/foundation/db-types";
import type { Logger } from "@bedrock/foundation/kernel";
import { noopLogger } from "@bedrock/foundation/kernel";
import type { AccountingPackDefinition } from "@bedrock/foundation/packs/schema";

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
