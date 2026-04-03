import type {
  LedgerScopedPostingRow,
  ListScopedPostingRowsInput,
} from "../../../contracts";

export interface LedgerReportsReads {
  listScopedPostingRows(
    input: ListScopedPostingRowsInput,
  ): Promise<LedgerScopedPostingRow[]>;
}
