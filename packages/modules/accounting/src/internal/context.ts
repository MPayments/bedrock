import type { AccountingPackDefinition } from "@bedrock/accounting/packs/schema";
import type { Logger } from "@bedrock/kernel/logger";
import type { Database } from "@bedrock/kernel/db/types";
import { noopLogger } from "@bedrock/kernel/logger";

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
