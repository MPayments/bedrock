import type { Database } from "@bedrock/db";
import { noopLogger, type Logger } from "@bedrock/kernel";

export interface AccountingReportingServiceDeps {
  db: Database;
  logger?: Logger;
}

interface AccountingReportingServiceContext {
  db: Database;
  log: Logger;
}

export function createAccountingReportingServiceContext(
  deps: AccountingReportingServiceDeps,
): AccountingReportingServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "accounting-reporting" }) ?? noopLogger,
  };
}
