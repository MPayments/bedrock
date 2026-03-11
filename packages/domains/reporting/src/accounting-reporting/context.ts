import { noopLogger, type Logger } from "@multihansa/common";
import type { Database } from "@multihansa/common/sql/ports";
import type { LedgerReadService } from "@multihansa/ledger";
import type { DimensionRegistry } from "@multihansa/common/registers";

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
