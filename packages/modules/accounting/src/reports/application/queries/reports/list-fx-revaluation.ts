import type { FxRevaluationQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListFxRevaluationQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: FxRevaluationQuery) {
    return this.reads.listFxRevaluation(query);
  }
}
