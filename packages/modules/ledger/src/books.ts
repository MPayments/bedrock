import type { Transaction } from "@bedrock/platform/persistence";

import {
  createEnsureDefaultOrganizationBookHandler,
} from "./application/books/ensure-default-organization-book";
import type { EnsureDefaultOrganizationBookInput } from "./application/books/ports";
import { createDrizzleLedgerBooksRepository } from "./infra/drizzle/repos/books-repository";

export interface LedgerBooksService {
  ensureDefaultOrganizationBook: (
    tx: Transaction,
    input: EnsureDefaultOrganizationBookInput,
  ) => Promise<{ bookId: string }>;
}

export function createLedgerBooksService(): LedgerBooksService {
  const ensureDefaultOrganizationBook = createEnsureDefaultOrganizationBookHandler(
    {
      books: createDrizzleLedgerBooksRepository(),
    },
  );

  return {
    ensureDefaultOrganizationBook,
  };
}
