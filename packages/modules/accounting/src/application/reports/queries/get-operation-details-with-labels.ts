import type {
  AccountingReportsLedgerPort,
  AccountingReportsServicePorts,
} from "../ports";
import {
  createListOperationDetailsWithLabelsQuery,
  type LedgerOperationDetailsWithLabels,
} from "./list-operation-details-with-labels";

export { type LedgerOperationDetailsWithLabels };

export function createGetOperationDetailsWithLabelsQuery(input: {
  ledgerReadPort: Pick<AccountingReportsLedgerPort, "listOperationDetails">;
  listCurrencyPrecisionsByCode: AccountingReportsServicePorts["listCurrencyPrecisionsByCode"];
  resolveDimensionLabelsFromRecords: AccountingReportsServicePorts["resolveDimensionLabelsFromRecords"];
}) {
  const listOperationDetailsWithLabels =
    createListOperationDetailsWithLabelsQuery(input);

  return async function getOperationDetailsWithLabels(
    operationId: string,
  ): Promise<LedgerOperationDetailsWithLabels | null> {
    return (
      (await listOperationDetailsWithLabels([operationId])).get(operationId) ??
      null
    );
  };
}
