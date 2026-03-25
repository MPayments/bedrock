import type { ModuleRuntime } from "@bedrock/shared/core";

import { ApplicationNotFoundError } from "../../../errors";
import {
  UpdateApplicationCommentInputSchema,
  type UpdateApplicationCommentInput,
} from "../contracts/commands";
import type { ApplicationsCommandUnitOfWork } from "../ports/applications.uow";

export class UpdateApplicationCommentCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: ApplicationsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateApplicationCommentInput) {
    const validated = UpdateApplicationCommentInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const existing = await tx.applicationStore.findById(validated.id);
      if (!existing) {
        throw new ApplicationNotFoundError(validated.id);
      }

      const updated = await tx.applicationStore.updateComment(
        validated.id,
        validated.comment,
      );

      this.runtime.log.info("Application comment updated", {
        id: validated.id,
      });

      return updated;
    });
  }
}
