import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  ApplicationInvalidStatusTransitionError,
  ApplicationNotFoundError,
} from "../../../errors";
import {
  canTransition,
  type ApplicationStatus,
} from "../../domain/application-status";
import {
  UpdateApplicationStatusInputSchema,
  type UpdateApplicationStatusInput,
} from "../contracts/commands";
import type { ApplicationsCommandUnitOfWork } from "../ports/applications.uow";

export class UpdateApplicationStatusCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ApplicationsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateApplicationStatusInput) {
    const validated = UpdateApplicationStatusInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.applicationStore.findById(validated.id);
      if (!existing) {
        throw new ApplicationNotFoundError(validated.id);
      }

      const currentStatus = existing.status as ApplicationStatus;
      if (!canTransition(currentStatus, validated.status)) {
        throw new ApplicationInvalidStatusTransitionError(
          currentStatus,
          validated.status,
        );
      }

      const updated = await tx.applicationStore.updateStatus(
        validated.id,
        validated.status,
        validated.reason,
      );

      this.runtime.log.info("Application status updated", {
        id: validated.id,
        from: currentStatus,
        to: validated.status,
      });

      return updated;
    });
  }
}
