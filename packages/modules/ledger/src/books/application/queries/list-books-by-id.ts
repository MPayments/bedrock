import type { LedgerBookRow } from "../../../contracts";
import type { LedgerBooksReads } from "../ports/book.reads";

export class ListBooksByIdQuery {
  constructor(private readonly reads: LedgerBooksReads) {}

  execute(ids: string[]): Promise<LedgerBookRow[]> {
    return this.reads.listById(ids);
  }
}
