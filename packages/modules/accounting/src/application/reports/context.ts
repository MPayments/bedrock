import type { LedgerReadService } from "@bedrock/ledger";
import { noopLogger, type Logger } from "@bedrock/platform-observability/logger";
import type { Database } from "@bedrock/platform-persistence";

export interface AccountingReportsServiceDeps {
  db: Database;
  ledgerReadService: Pick<LedgerReadService, "getOperationDetails" | "listOperations">;
  logger?: Logger;
}

interface AccountingReportsServiceContext {
  db: Database;
  ledgerReadService: Pick<LedgerReadService, "getOperationDetails" | "listOperations">;
  log: Logger;
}

export function createAccountingReportsServiceContext(
  deps: AccountingReportsServiceDeps,
): AccountingReportsServiceContext {
  return {
    db: deps.db,
    ledgerReadService: deps.ledgerReadService,
    log: deps.logger?.child({ service: "accounting-reports" }) ?? noopLogger,
  };
}
