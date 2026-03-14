import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "./ports";
import {
  createGetOperationDetailsWithLabelsQuery,
  type LedgerOperationDetailsWithLabels,
} from "./queries/get-operation-details-with-labels";
import {
  createListOperationsWithLabelsQuery,
  type LedgerOperationListWithLabels,
} from "./queries/list-operations-with-labels";
import type { AccountingReportQueries } from "./queries/reports";

export type AccountingReportsService = ReturnType<
  typeof createAccountingReportsHandlers
>;

export function createAccountingReportsHandlers(input: {
  ledgerReadPort: AccountingReportsLedgerPort;
  reportQueries: AccountingReportQueries;
} & AccountingReportsServicePorts) {
  const {
    ledgerReadPort,
    listBookNamesById,
    listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords,
    reportQueries,
  } = input;

  const getOperationDetailsWithLabels = createGetOperationDetailsWithLabelsQuery({
    ledgerReadPort,
    listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords,
  });
  const listOperationsWithLabels = createListOperationsWithLabelsQuery({
    ledgerReadPort,
    listBookNamesById,
  });

  return {
    getOperationDetailsWithLabels: (
      operationId: string,
    ): Promise<LedgerOperationDetailsWithLabels | null> =>
      getOperationDetailsWithLabels(operationId),
    listOperationsWithLabels: (
      query?: Parameters<
        AccountingReportsLedgerPort["listOperations"]
      >[0],
    ): Promise<LedgerOperationListWithLabels> =>
      listOperationsWithLabels(query),
    ...reportQueries,
  };
}
