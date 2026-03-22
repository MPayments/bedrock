import type { ReportsReads } from "../../ports/reports.reads";
import type { FeeRevenueQuery } from "../../contracts/queries";

export class ListFeeRevenueQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: FeeRevenueQuery) {
    return this.reads.listFeeRevenue(query);
  }
}
