import type { ModuleRuntime } from "@bedrock/shared/core";

import { BankDetailsNotFoundError } from "../../../errors";
import type { OrganizationsCommandUnitOfWork } from "../ports/organizations.uow";

export class RestoreBankDetailsCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: OrganizationsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const restored = await tx.bankDetailsStore.restore(id);
      if (!restored) {
        throw new BankDetailsNotFoundError(id);
      }

      this.runtime.log.info("Bank details restored", { id });

      return restored;
    });
  }
}
