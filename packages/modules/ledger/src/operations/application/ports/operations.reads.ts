import type {
  LedgerOperationDetails,
  LedgerOperationList,
  ListLedgerOperationsInput,
} from "../../../contracts";

export interface LedgerOperationsReads {
  list(
    input?: ListLedgerOperationsInput,
  ): Promise<LedgerOperationList>;
  listDetails(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetails>>;
  getDetails(
    operationId: string,
  ): Promise<LedgerOperationDetails | null>;
}
