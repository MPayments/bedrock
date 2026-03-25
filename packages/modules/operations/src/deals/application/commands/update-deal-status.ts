import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  DealInvalidStatusTransitionError,
  DealNotFoundError,
} from "../../../errors";
import {
  canTransitionDeal,
  type DealStatus,
} from "../../domain/deal-status";
import {
  UpdateDealStatusInputSchema,
  type UpdateDealStatusInput,
} from "../contracts/commands";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class UpdateDealStatusCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: DealsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateDealStatusInput) {
    const validated = UpdateDealStatusInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.dealStore.findById(validated.id);
      if (!existing) {
        throw new DealNotFoundError(validated.id);
      }

      const currentStatus = existing.status as DealStatus;
      if (!canTransitionDeal(currentStatus, validated.status)) {
        throw new DealInvalidStatusTransitionError(
          currentStatus,
          validated.status,
        );
      }

      const closedAt =
        validated.status === "done" ? new Date().toISOString() : undefined;

      const updated = await tx.dealStore.updateStatus(
        validated.id,
        validated.status,
        closedAt,
      );

      this.runtime.log.info("Deal status updated", {
        id: validated.id,
        from: currentStatus,
        to: validated.status,
      });

      return updated;
    });
  }
}
