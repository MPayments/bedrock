import type { ModuleRuntime } from "@bedrock/shared/core";

import { ContractNotFoundError } from "../../../errors";
import {
  UpdateContractInputSchema,
  type UpdateContractInput,
} from "../contracts/commands";
import type { ContractsCommandUnitOfWork } from "../ports/contracts.uow";

export class UpdateContractCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ContractsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateContractInput) {
    const validated = UpdateContractInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.contractStore.findById(validated.id);
      if (!existing) {
        throw new ContractNotFoundError(validated.id);
      }

      const updated = await tx.contractStore.update(validated);

      this.runtime.log.info("Contract updated", { id: validated.id });

      return updated;
    });
  }
}
