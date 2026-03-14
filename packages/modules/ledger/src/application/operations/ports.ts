import type {
  LedgerOperationDetails,
  LedgerOperationList,
} from "../../contracts/dto";
import type { ListLedgerOperationsInput } from "../../contracts/queries";

export interface LedgerReadPort {
  listOperations: (
    input?: ListLedgerOperationsInput,
  ) => Promise<LedgerOperationList>;
  getOperationDetails: (
    operationId: string,
  ) => Promise<LedgerOperationDetails | null>;
}
