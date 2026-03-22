import type { ReportsReads } from "../../ports/reports.reads";
import type { LiquidityQuery } from "../../contracts/queries";

export class ListLiquidityQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: LiquidityQuery) {
    return this.reads.listLiquidity(query);
  }
}
