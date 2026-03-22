import {
  ListOperationsWithLabelsQuerySchema,
  type ListOperationsWithLabelsQuery as ListOperationsWithLabelsInput,
} from "../contracts/operation-queries";
import type { ReportsReads } from "../ports/reports.reads";

export class ListOperationsWithLabelsQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: ListOperationsWithLabelsInput) {
    return this.reads.listOperationsWithLabels(
      ListOperationsWithLabelsQuerySchema.parse(query ?? {}),
    );
  }
}
