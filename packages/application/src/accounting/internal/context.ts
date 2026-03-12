import type { AccountingPackDefinition } from "@bedrock/application/accounting/packs/schema";
import type { Logger } from "@bedrock/common";
import { noopLogger } from "@bedrock/common";
import type { Database } from "@bedrock/common/db/types";

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
