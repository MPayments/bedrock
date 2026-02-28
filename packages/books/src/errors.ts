import { NotFoundError, ServiceError } from "@bedrock/kernel/errors";

export class BooksError extends ServiceError {}

export class BookNotFoundError extends NotFoundError {
  constructor(bookId: string) {
    super("Book", bookId);
  }
}
