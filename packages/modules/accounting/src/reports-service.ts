export * from "./contracts/reports/dto";
export * from "./contracts/reports/queries";
export type {
  AccountingReportsContext,
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "./application/reports/ports";
export {
  createAccountingReportQueries,
  type AccountingReportQueries,
} from "./application/reports/queries/reports";
export {
  createDrizzleAccountingReportsRepository,
  type AccountingReportsRepository,
} from "./infra/drizzle/repos/reports-repository";
export {
  createBedrockDimensionRegistry,
  type DimensionDocumentsQueries as AccountingReportsDocumentsQueries,
} from "./infra/reporting/dimensions";
export { createAccountingReportsContext } from "./infra/reporting/context";

import {
  createAccountingReportsHandlers,
  type AccountingReportsService,
} from "./application/reports";
import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "./application/reports/ports";
import type { AccountingReportQueries } from "./application/reports/queries/reports";

export { type AccountingReportsService };

export interface AccountingReportsServiceDeps
  extends AccountingReportsServicePorts {
  ledgerReadPort: AccountingReportsLedgerPort;
  reportQueries: AccountingReportQueries;
}

export function createAccountingReportsService(
  deps: AccountingReportsServiceDeps,
): AccountingReportsService {
  return createAccountingReportsHandlers({
    ledgerReadPort: deps.ledgerReadPort,
    listBookNamesById: deps.listBookNamesById,
    listCurrencyPrecisionsByCode: deps.listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords: deps.resolveDimensionLabelsFromRecords,
    reportQueries: deps.reportQueries,
  });
}
