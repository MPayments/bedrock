import type { AccountingReportsLedgerPort } from "../ports";
import type { AccountingReportQueries } from "../queries/reports";
import type { LedgerOperationDetailsWithLabels } from "../queries/get-operation-details-with-labels";
import type { LedgerOperationListWithLabels } from "../queries/list-operations-with-labels";

export interface ReportsReads extends AccountingReportQueries {
  getOperationDetailsWithLabels(
    operationId: string,
  ): Promise<LedgerOperationDetailsWithLabels | null>;
  listOperationDetailsWithLabels(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetailsWithLabels>>;
  listOperationsWithLabels(
    query?: Parameters<AccountingReportsLedgerPort["listOperations"]>[0],
  ): Promise<LedgerOperationListWithLabels>;
}
