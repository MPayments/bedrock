import type { CashFlowQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListCashFlowQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: CashFlowQuery) {
    return this.reads.listCashFlow(query);
  }
}
