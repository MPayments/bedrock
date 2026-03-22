import type { ReportsReads } from "../../ports/reports.reads";
import type { TrialBalanceQuery } from "../../contracts/queries";

export class ListTrialBalanceQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: TrialBalanceQuery) {
    return this.reads.listTrialBalance(query);
  }
}
