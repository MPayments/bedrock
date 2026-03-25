import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ApplicationNotFoundError,
  DealAlreadyExistsForApplicationError,
} from "../../../errors";
import {
  CreateDealInputSchema,
  type CreateDealInput,
} from "../contracts/commands";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class CreateDealCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: DealsCommandUnitOfWork,
  ) {}

  async execute(input: CreateDealInput) {
    const validated = CreateDealInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      // Verify application exists
      const application = await tx.applicationStore.findById(
        validated.applicationId,
      );
      if (!application) {
        throw new ApplicationNotFoundError(validated.applicationId);
      }

      // Check no existing deal for this application
      const existingDeal = await tx.dealStore.findByApplicationId(
        validated.applicationId,
      );
      if (existingDeal) {
        throw new DealAlreadyExistsForApplicationError(
          validated.applicationId,
        );
      }

      const deal = await tx.dealStore.create(validated);

      // Set application status to finished
      await tx.applicationStore.updateStatus(
        validated.applicationId,
        "finished",
      );

      this.runtime.log.info("Deal created", {
        id: deal.id,
        applicationId: deal.applicationId,
      });

      return deal;
    });
  }
}
