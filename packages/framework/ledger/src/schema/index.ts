import { books } from "./books";
import { ledgerOperations, postings } from "./journal";
import { bookAccountInstances } from "./ledger";
import { outbox } from "./outbox";
import { tbTransferPlans } from "./tb-plan";

export const schema = {
  books,
  bookAccountInstances,
  ledgerOperations,
  postings,
  outbox,
  tbTransferPlans,
};

export { books, ledgerOperations, postings, bookAccountInstances, outbox, tbTransferPlans };

export type { Book, BookInsert } from "./books";
export { type LedgerOperationStatus } from "./journal";
export {
  type BookAccountInstance,
  type BookAccountInstanceInsert,
  type Dimensions,
} from "./ledger";
