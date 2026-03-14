import type { LedgerReadService } from "@bedrock/ledger";

import type { AccountingReportsServicePorts } from "./ports";
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
  ledgerReadService: Pick<
    LedgerReadService,
    "getOperationDetails" | "listOperations"
  >;
  reportQueries: AccountingReportQueries;
} & AccountingReportsServicePorts) {
  const {
    ledgerReadService,
    listBookNamesById,
    listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords,
    reportQueries,
  } = input;

  const getOperationDetailsWithLabels = createGetOperationDetailsWithLabelsQuery({
    ledgerReadService,
    listCurrencyPrecisionsByCode,
    resolveDimensionLabelsFromRecords,
  });
  const listOperationsWithLabels = createListOperationsWithLabelsQuery({
    ledgerReadService,
    listBookNamesById,
  });

  return {
    getOperationDetailsWithLabels: (
      operationId: string,
    ): Promise<LedgerOperationDetailsWithLabels | null> =>
      getOperationDetailsWithLabels(operationId),
    listOperationsWithLabels: (
      query?: Parameters<
        Pick<LedgerReadService, "listOperations">["listOperations"]
      >[0],
    ): Promise<LedgerOperationListWithLabels> =>
      listOperationsWithLabels(query),
    ...reportQueries,
  };
}
