import type { ModuleRuntime } from "@bedrock/shared/core";

import { EnsureDefaultOrganizationBookCommand } from "./commands/ensure-default-organization-book";
import type { LedgerBooksReads } from "./ports/book.reads";
import type { BooksCommandUnitOfWork } from "./ports/books.uow";
import { ListBooksByIdQuery } from "./queries/list-books-by-id";
import { ListBooksByOwnerIdQuery } from "./queries/list-books-by-owner-id";

export interface BooksServiceDeps {
  runtime: ModuleRuntime;
  reads: LedgerBooksReads;
  commandUow: BooksCommandUnitOfWork;
}

export function createBooksService(deps: BooksServiceDeps) {
  const ensureDefaultOrganizationBook =
    new EnsureDefaultOrganizationBookCommand(deps.runtime, deps.commandUow);
  const listById = new ListBooksByIdQuery(deps.reads);
  const listByOwnerId = new ListBooksByOwnerIdQuery(deps.reads);

  return {
    commands: {
      ensureDefaultOrganizationBook:
        ensureDefaultOrganizationBook.execute.bind(
          ensureDefaultOrganizationBook,
        ),
    },
    queries: {
      listById: listById.execute.bind(listById),
      listByOwnerId: listByOwnerId.execute.bind(listByOwnerId),
    },
  };
}

export type BooksService = ReturnType<typeof createBooksService>;
