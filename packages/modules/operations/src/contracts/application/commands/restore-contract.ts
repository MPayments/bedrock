import type { ModuleRuntime } from "@bedrock/shared/core";

import { ContractNotFoundError } from "../../../errors";
import type { ContractsCommandUnitOfWork } from "../ports/contracts.uow";

export class RestoreContractCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ContractsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.contractStore.findById(id);
      if (!existing) {
        throw new ContractNotFoundError(id);
      }

      await tx.contractStore.restore(id);

      this.runtime.log.info("Contract restored", { id });

      return true;
    });
  }
}
