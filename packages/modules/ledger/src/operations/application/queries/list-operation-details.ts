import type { LedgerOperationDetails } from "../../../contracts";
import type { LedgerOperationsReads } from "../ports/operations.reads";

export class ListOperationDetailsQuery {
  constructor(private readonly reads: LedgerOperationsReads) {}

  execute(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetails>> {
    return this.reads.listDetails(operationIds);
  }
}
