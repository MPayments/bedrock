import type { LedgerBookRow } from "../../../contracts";
import type { LedgerBooksReads } from "../ports/book.reads";

export class ListBooksByOwnerIdQuery {
  constructor(private readonly reads: LedgerBooksReads) {}

  execute(ownerId: string): Promise<LedgerBookRow[]> {
    return this.reads.listByOwnerId(ownerId);
  }
}
