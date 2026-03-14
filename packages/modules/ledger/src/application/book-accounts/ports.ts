import type { Transaction } from "@bedrock/platform/persistence";

import type {
  BookAccountIdentityInput,
  BookAccountInstanceRef,
} from "../../domain/book-account-identity";

export interface LedgerBookAccountsPort {
  ensureBookAccountInstanceTx: (
    tx: Transaction,
    input: BookAccountIdentityInput,
  ) => Promise<BookAccountInstanceRef>;
}
