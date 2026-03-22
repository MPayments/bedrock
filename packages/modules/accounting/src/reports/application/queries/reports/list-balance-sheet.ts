import type { BalanceSheetQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListBalanceSheetQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: BalanceSheetQuery) {
    return this.reads.listBalanceSheet(query);
  }
}
