import {
  ListOperationDetailsWithLabelsInputSchema,
  type ListOperationDetailsWithLabelsInput,
} from "../contracts/operation-queries";
import type { ReportsReads } from "../ports/reports.reads";

export class ListOperationDetailsWithLabelsQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(operationIds: ListOperationDetailsWithLabelsInput) {
    return this.reads.listOperationDetailsWithLabels(
      ListOperationDetailsWithLabelsInputSchema.parse(operationIds),
    );
  }
}
