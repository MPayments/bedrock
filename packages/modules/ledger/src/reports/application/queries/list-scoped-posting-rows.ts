import type {
  LedgerScopedPostingRow,
  ListScopedPostingRowsInput,
} from "../../../contracts";
import type { LedgerReportsReads } from "../ports/reports.reads";

export class ListScopedPostingRowsQuery {
  constructor(private readonly reads: LedgerReportsReads) {}

  execute(
    input: ListScopedPostingRowsInput,
  ): Promise<LedgerScopedPostingRow[]> {
    return this.reads.listScopedPostingRows(input);
  }
}
