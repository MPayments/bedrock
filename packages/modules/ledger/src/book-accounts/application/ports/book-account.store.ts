import type {
  BookAccountIdentityInput,
  BookAccountInstanceRef,
} from "../../domain/book-account-identity";

export interface LedgerBookAccountStore {
  ensureBookAccountInstance: (
    input: BookAccountIdentityInput,
  ) => Promise<BookAccountInstanceRef>;
}
