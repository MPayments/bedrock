import type {
  AccountingScopedPostingRow,
  ListScopedPostingRowsInput,
} from "../../../contracts";

export interface LedgerReportsReads {
  listScopedPostingRows(
    input: ListScopedPostingRowsInput,
  ): Promise<AccountingScopedPostingRow[]>;
}
