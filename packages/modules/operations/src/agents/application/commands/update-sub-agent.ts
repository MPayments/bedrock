import type { ModuleRuntime } from "@bedrock/shared/core";

import { SubAgentNotFoundError } from "../../../errors";
import {
  UpdateSubAgentInputSchema,
  type UpdateSubAgentInput,
} from "../contracts/sub-agent-commands";
import type { SubAgentsCommandUnitOfWork } from "../ports/sub-agents.uow";

export class UpdateSubAgentCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: SubAgentsCommandUnitOfWork,
  ) {}

  async execute(input: UpdateSubAgentInput) {
    const validated = UpdateSubAgentInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const updated = await tx.subAgentStore.update(validated);
      if (!updated) {
        throw new SubAgentNotFoundError(validated.id);
      }

      this.runtime.log.info("Sub-agent updated", {
        id: updated.id,
        name: updated.name,
      });

      return updated;
    });
  }
}
