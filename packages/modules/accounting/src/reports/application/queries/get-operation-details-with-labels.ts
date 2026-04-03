import { type LedgerOperationDetailsWithLabels } from "./list-operation-details-with-labels";
import {
  GetOperationDetailsWithLabelsInputSchema,
  type GetOperationDetailsWithLabelsInput,
} from "../contracts/operation.queries";
import type { ReportsReads } from "../ports/reports.reads";

export { type LedgerOperationDetailsWithLabels };

export class GetOperationDetailsWithLabelsQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(operationId: GetOperationDetailsWithLabelsInput) {
    const validated =
      GetOperationDetailsWithLabelsInputSchema.parse(operationId);

    return this.reads.getOperationDetailsWithLabels(validated);
  }
}
