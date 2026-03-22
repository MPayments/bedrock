import type { GeneralLedgerQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListGeneralLedgerQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: GeneralLedgerQuery) {
    return this.reads.listGeneralLedger(query);
  }
}
