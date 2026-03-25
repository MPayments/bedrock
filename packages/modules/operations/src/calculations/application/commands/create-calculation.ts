import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CreateCalculationInputSchema,
  type CreateCalculationInput,
} from "../contracts/commands";
import type { CalculationsCommandUnitOfWork } from "../ports/calculations.uow";

export class CreateCalculationCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: CalculationsCommandUnitOfWork,
  ) {}

  async execute(input: CreateCalculationInput) {
    const validated = CreateCalculationInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const created = await tx.calculationStore.create(validated);

      this.runtime.log.info("Calculation created", {
        id: created.id,
        applicationId: created.applicationId,
        currencyCode: created.currencyCode,
      });

      return created;
    });
  }
}
