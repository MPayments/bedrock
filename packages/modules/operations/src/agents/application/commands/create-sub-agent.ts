import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  CreateSubAgentInputSchema,
  type CreateSubAgentInput,
} from "../contracts/sub-agent-commands";
import type { SubAgentsCommandUnitOfWork } from "../ports/sub-agents.uow";

export class CreateSubAgentCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: SubAgentsCommandUnitOfWork,
  ) {}

  async execute(input: CreateSubAgentInput) {
    const validated = CreateSubAgentInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const created = await tx.subAgentStore.create(validated);

      this.runtime.log.info("Sub-agent created", {
        id: created.id,
        name: created.name,
      });

      return created;
    });
  }
}
