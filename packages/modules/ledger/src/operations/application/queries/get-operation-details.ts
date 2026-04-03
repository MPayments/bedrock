import type { LedgerOperationDetails } from "../../../contracts";
import type { LedgerOperationsReads } from "../ports/operations.reads";

export class GetOperationDetailsQuery {
  constructor(private readonly reads: LedgerOperationsReads) {}

  execute(operationId: string): Promise<LedgerOperationDetails | null> {
    return this.reads.getDetails(operationId);
  }
}
