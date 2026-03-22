import type { LedgerBookRow } from "../../../contracts";

export interface LedgerBooksReads {
  listById(ids: string[]): Promise<LedgerBookRow[]>;
  listByOwnerId(ownerId: string): Promise<LedgerBookRow[]>;
}
