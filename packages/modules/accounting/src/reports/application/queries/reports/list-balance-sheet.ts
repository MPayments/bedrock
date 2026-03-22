import type { ReportsReads } from "../../ports/reports.reads";
import type { BalanceSheetQuery } from "../../contracts/queries";

export class ListBalanceSheetQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: BalanceSheetQuery) {
    return this.reads.listBalanceSheet(query);
  }
}
