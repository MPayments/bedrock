import type { ReportsReads } from "../../ports/reports.reads";
import type { IncomeStatementQuery } from "../../contracts/queries";

export class ListIncomeStatementQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: IncomeStatementQuery) {
    return this.reads.listIncomeStatement(query);
  }
}
