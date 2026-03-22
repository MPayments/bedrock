import type { ModuleRuntime } from "@bedrock/shared/core";

import type { BookAccountIdentityInput } from "../../domain/book-account-identity";
import type { BookAccountsCommandUnitOfWork } from "../ports/book-accounts.uow";

export class EnsureBookAccountInstanceCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: BookAccountsCommandUnitOfWork,
  ) {}

  async execute(input: BookAccountIdentityInput) {
    const result = await this.unitOfWork.run(async (tx) => {
      return tx.bookAccounts.ensureBookAccountInstance(input);
    });

    this.runtime.log.info("Book account instance ensured", {
      accountNo: input.accountNo,
      bookId: input.bookId,
      bookAccountInstanceId: result.id,
      currency: input.currency,
    });

    return result;
  }
}
