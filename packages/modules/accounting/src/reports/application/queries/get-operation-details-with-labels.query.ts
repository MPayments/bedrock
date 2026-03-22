import {
  GetOperationDetailsWithLabelsInputSchema,
  type GetOperationDetailsWithLabelsInput,
} from "../contracts/operation-queries";
import type { ReportsReads } from "../ports/reports.reads";

export class GetOperationDetailsWithLabelsQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(operationId: GetOperationDetailsWithLabelsInput) {
    return this.reads.getOperationDetailsWithLabels(
      GetOperationDetailsWithLabelsInputSchema.parse(operationId),
    );
  }
}
