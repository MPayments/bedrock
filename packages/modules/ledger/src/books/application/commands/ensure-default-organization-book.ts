import type { ModuleRuntime } from "@bedrock/shared/core";

import type { EnsureDefaultOrganizationBookInput } from "../ports/book.store";
import type { BooksCommandUnitOfWork } from "../ports/books.uow";

export class EnsureDefaultOrganizationBookCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: BooksCommandUnitOfWork,
  ) {}

  async execute(input: EnsureDefaultOrganizationBookInput) {
    const result = await this.unitOfWork.run(async (tx) => {
      return tx.books.ensureDefaultOrganizationBook(input);
    });

    this.runtime.log.info("Default organization book ensured", {
      organizationId: input.organizationId,
      bookId: result.bookId,
    });

    return result;
  }
}
