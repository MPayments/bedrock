import type {
  AccountingScopedPostingRow,
  LedgerBookRow,
} from "../../contracts/dto";
import type { ListScopedPostingRowsInput } from "../../contracts/queries";

export interface LedgerReportingPort {
  listBooksById: (ids: string[]) => Promise<LedgerBookRow[]>;
  listBooksByOwnerId: (ownerId: string) => Promise<LedgerBookRow[]>;
  listScopedPostingRows: (
    input: ListScopedPostingRowsInput,
  ) => Promise<AccountingScopedPostingRow[]>;
}
