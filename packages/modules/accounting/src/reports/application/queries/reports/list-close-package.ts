import type { ClosePackageQuery } from "../../contracts/queries";
import type { ReportsReads } from "../../ports/reports.reads";

export class ListClosePackageQuery {
  constructor(private readonly reads: ReportsReads) {}

  execute(query?: ClosePackageQuery) {
    return this.reads.listClosePackage(query);
  }
}
