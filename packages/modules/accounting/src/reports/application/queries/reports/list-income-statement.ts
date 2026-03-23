import type { IncomeStatementQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListIncomeStatementQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: IncomeStatementQuery) {
    return this.reads.listIncomeStatement(query);
  }
}
