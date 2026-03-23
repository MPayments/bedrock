import type { ListLedgerOperationsInput } from "@bedrock/ledger/contracts";

import type { LedgerOperationDetailsWithLabels } from "../queries/get-operation-details-with-labels";
import type { LedgerOperationListWithLabels } from "../queries/list-operations-with-labels";
import type { AccountingReportQueries } from "../queries/reports";

export interface ReportsReads extends AccountingReportQueries {
  getOperationDetailsWithLabels(
    operationId: string,
  ): Promise<LedgerOperationDetailsWithLabels | null>;
  listOperationDetailsWithLabels(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetailsWithLabels>>;
  listOperationsWithLabels(
    query?: ListLedgerOperationsInput,
  ): Promise<LedgerOperationListWithLabels>;
}
