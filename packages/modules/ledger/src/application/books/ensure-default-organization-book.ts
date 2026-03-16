import type { Transaction } from "@bedrock/platform/persistence";

import type {
  EnsureDefaultOrganizationBookInput,
  LedgerBooksPort,
} from "./ports";

export function createEnsureDefaultOrganizationBookHandler(input: {
  books: LedgerBooksPort;
}) {
  const { books } = input;

  return function ensureDefaultOrganizationBook(
    tx: Transaction,
    payload: EnsureDefaultOrganizationBookInput,
  ) {
    return books.ensureDefaultOrganizationBookTx(tx, payload);
  };
}
