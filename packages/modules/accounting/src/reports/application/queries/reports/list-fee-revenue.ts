import type { FeeRevenueQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListFeeRevenueQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: FeeRevenueQuery) {
    return this.reads.listFeeRevenue(query);
  }
}
