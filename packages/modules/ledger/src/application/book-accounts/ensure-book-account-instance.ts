import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type { LedgerBookAccountsPort } from "./ports";
import type { BookAccountIdentityInput } from "../../domain/book-account-identity";

export function createEnsureBookAccountInstanceHandler(input: {
  bookAccounts: LedgerBookAccountsPort;
}) {
  const { bookAccounts } = input;

  return function ensureBookAccountInstance(
    tx: PersistenceSession,
    identity: BookAccountIdentityInput,
  ) {
    return bookAccounts.ensureBookAccountInstanceTx(tx, identity);
  };
}
