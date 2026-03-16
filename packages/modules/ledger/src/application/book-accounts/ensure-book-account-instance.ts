import type { Transaction } from "@bedrock/platform/persistence";

import type { LedgerBookAccountsPort } from "./ports";
import type { BookAccountIdentityInput } from "../../domain/book-account-identity";

export function createEnsureBookAccountInstanceHandler(input: {
  bookAccounts: LedgerBookAccountsPort;
}) {
  const { bookAccounts } = input;

  return function ensureBookAccountInstance(
    tx: Transaction,
    identity: BookAccountIdentityInput,
  ) {
    return bookAccounts.ensureBookAccountInstanceTx(tx, identity);
  };
}
