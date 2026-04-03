import type { LedgerBookStore } from "./book.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface BooksCommandTx {
  books: LedgerBookStore;
}

export type BooksCommandUnitOfWork = UnitOfWork<BooksCommandTx>;
