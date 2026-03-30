import type { ModuleRuntime } from "@bedrock/shared/core";

import { CalculationNotFoundError } from "../../errors";
import type { CalculationsCommandUnitOfWork } from "../ports/calculations.uow";

export class ArchiveCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: CalculationsCommandUnitOfWork,
  ) {}

  async execute(id: string): Promise<boolean> {
    return this.commandUow.run(async (tx) => {
      const existing = await tx.calculationReads.findById(id);

      if (!existing) {
        throw new CalculationNotFoundError(id);
      }

      await tx.calculationStore.setActive({
        calculationId: id,
        isActive: false,
      });

      this.runtime.log.info("Calculation archived", { calculationId: id });

      return true;
    });
  }
}
