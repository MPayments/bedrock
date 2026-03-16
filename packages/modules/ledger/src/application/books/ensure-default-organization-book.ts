import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  EnsureDefaultOrganizationBookInput,
  LedgerBooksPort,
} from "./ports";

export function createEnsureDefaultOrganizationBookHandler(input: {
  books: LedgerBooksPort;
}) {
  const { books } = input;

  return function ensureDefaultOrganizationBook(
    tx: PersistenceSession,
    payload: EnsureDefaultOrganizationBookInput,
  ) {
    return books.ensureDefaultOrganizationBookTx(tx, payload);
  };
}
