import { noopLogger, type Logger } from "@bedrock/kernel";
import type { LedgerReadService } from "@bedrock/ledger";
import type { DimensionRegistry } from "@bedrock/registers";
import type { Database } from "@bedrock/sql/ports";

export interface AccountingReportingServiceDeps {
  db: Database;
  ledgerReadService: Pick<LedgerReadService, "getOperationDetails" | "listOperations">;
  dimensionRegistry: Pick<DimensionRegistry, "resolveLabelsFromRecords">;
  logger?: Logger;
}

interface AccountingReportingServiceContext {
  db: Database;
  ledgerReadService: Pick<LedgerReadService, "getOperationDetails" | "listOperations">;
  dimensionRegistry: Pick<DimensionRegistry, "resolveLabelsFromRecords">;
  log: Logger;
}

export function createAccountingReportingServiceContext(
  deps: AccountingReportingServiceDeps,
): AccountingReportingServiceContext {
  return {
    db: deps.db,
    ledgerReadService: deps.ledgerReadService,
    dimensionRegistry: deps.dimensionRegistry,
    log: deps.logger?.child({ service: "accounting-reporting" }) ?? noopLogger,
  };
}
