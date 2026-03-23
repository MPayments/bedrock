import type { LiquidityQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListLiquidityQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: LiquidityQuery) {
    return this.reads.listLiquidity(query);
  }
}
