import type { Database } from "@bedrock/db";
import { noopLogger, type Logger } from "@bedrock/kernel";

export interface BooksServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface BooksServiceContext {
  db: Database;
  log: Logger;
}

export function createBooksServiceContext(
  deps: BooksServiceDeps,
): BooksServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ svc: "books" }) ?? noopLogger,
  };
}
