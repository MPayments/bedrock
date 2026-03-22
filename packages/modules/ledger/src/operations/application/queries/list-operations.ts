import type {
  LedgerOperationList,
  ListLedgerOperationsInput,
} from "../../../contracts";
import type { LedgerOperationsReads } from "../ports/operations.reads";

export class ListOperationsQuery {
  constructor(private readonly reads: LedgerOperationsReads) {}

  execute(input?: ListLedgerOperationsInput): Promise<LedgerOperationList> {
    return this.reads.list(input);
  }
}
