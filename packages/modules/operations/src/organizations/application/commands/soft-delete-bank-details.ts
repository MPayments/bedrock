import type { ModuleRuntime } from "@bedrock/shared/core";

import { BankDetailsNotFoundError } from "../../../errors";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class SoftDeleteBankDetailsCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const deleted = await tx.bankDetailsStore.softDelete(id);
      if (!deleted) {
        throw new BankDetailsNotFoundError(id);
      }

      this.runtime.log.info("Bank details soft-deleted", { id });

      return deleted;
    });
  }
}
