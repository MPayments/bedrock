import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../../errors";
import {
  UpdateDealDetailsInputSchema,
  type UpdateDealDetailsInput,
} from "../contracts/commands";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class UpdateDealDetailsCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: DealsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateDealDetailsInput) {
    const validated = UpdateDealDetailsInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.dealStore.findById(validated.id);
      if (!existing) {
        throw new DealNotFoundError(validated.id);
      }

      const updated = await tx.dealStore.updateDetails(validated);

      this.runtime.log.info("Deal details updated", { id: validated.id });

      return updated;
    });
  }
}
