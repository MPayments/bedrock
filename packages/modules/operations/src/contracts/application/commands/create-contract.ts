import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CreateContractInputSchema,
  type CreateContractInput,
} from "../contracts/commands";
import type { ContractsCommandUnitOfWork } from "../ports/contracts.uow";

export class CreateContractCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ContractsCommandUnitOfWork,
  ) {}

  async execute(input: CreateContractInput) {
    const validated = CreateContractInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const created = await tx.contractStore.create(validated);

      // Auto-assign contractNumber = id if not provided
      if (!created.contractNumber) {
        const updated = await tx.contractStore.update({
          id: created.id,
          contractNumber: String(created.id),
        });

        this.runtime.log.info("Contract created", {
          id: created.id,
          contractNumber: String(created.id),
        });

        return updated ?? created;
      }

      this.runtime.log.info("Contract created", {
        id: created.id,
        contractNumber: created.contractNumber,
      });

      return created;
    });
  }
}
