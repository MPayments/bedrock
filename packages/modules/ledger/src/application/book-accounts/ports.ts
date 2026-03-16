import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  BookAccountIdentityInput,
  BookAccountInstanceRef,
} from "../../domain/book-account-identity";

export interface LedgerBookAccountsPort {
  ensureBookAccountInstanceTx: (
    tx: PersistenceSession,
    input: BookAccountIdentityInput,
  ) => Promise<BookAccountInstanceRef>;
}
