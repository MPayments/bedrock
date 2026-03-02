import type { Database } from "@bedrock/foundation/db-types";
import { noopLogger, type Logger } from "@bedrock/foundation/kernel";
import type { LedgerReadService } from "@bedrock/ledger";

export interface AccountingReportingServiceDeps {
  db: Database;
  ledgerReadService: Pick<LedgerReadService, "getOperationDetails" | "listOperations">;
  logger?: Logger;
}

interface AccountingReportingServiceContext {
  db: Database;
  ledgerReadService: Pick<LedgerReadService, "getOperationDetails" | "listOperations">;
  log: Logger;
}

export function createAccountingReportingServiceContext(
  deps: AccountingReportingServiceDeps,
): AccountingReportingServiceContext {
  return {
    db: deps.db,
    ledgerReadService: deps.ledgerReadService,
    log: deps.logger?.child({ service: "accounting-reporting" }) ?? noopLogger,
  };
}
