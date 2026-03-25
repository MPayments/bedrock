import type { ModuleRuntime } from "@bedrock/shared/core";

import { CalculationNotFoundError } from "../../../errors";
import type { CalculationsCommandUnitOfWork } from "../ports/calculations.uow";

export class DeleteCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: CalculationsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.calculationStore.findById(id);
      if (!existing) {
        throw new CalculationNotFoundError(id);
      }

      await tx.calculationStore.remove(id);

      this.runtime.log.info("Calculation deleted", { id });

      return true;
    });
  }
}
