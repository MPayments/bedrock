import type { AccountingPackDefinition } from "@bedrock/accounting/packs/schema";
import type { Logger } from "@bedrock/observability/logger";
import type { Database } from "@bedrock/adapter-db-drizzle/db/types";
import { noopLogger } from "@bedrock/observability/logger";

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
