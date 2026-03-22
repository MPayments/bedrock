import type { ReportsReads } from "../../ports/reports.reads";
import type { FxRevaluationQuery } from "../../contracts/queries";

export class ListFxRevaluationQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: FxRevaluationQuery) {
    return this.reads.listFxRevaluation(query);
  }
}
