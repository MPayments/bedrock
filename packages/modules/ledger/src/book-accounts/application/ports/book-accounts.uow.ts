import type { LedgerBookAccountStore } from "./book-account.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface BookAccountsCommandTx {
  bookAccounts: LedgerBookAccountStore;
}

export type BookAccountsCommandUnitOfWork =
  UnitOfWork<BookAccountsCommandTx>;
