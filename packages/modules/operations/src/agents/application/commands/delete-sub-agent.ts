import type { ModuleRuntime } from "@bedrock/shared/core";

import { SubAgentNotFoundError } from "../../../errors";
import type { SubAgentsCommandUnitOfWork } from "../ports/sub-agents.uow";

export class DeleteSubAgentCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: SubAgentsCommandUnitOfWork,
  ) {}

  async execute(id: number) {
    return this.unitOfWork.run(async (tx) => {
      const deleted = await tx.subAgentStore.remove(id);
      if (!deleted) {
        throw new SubAgentNotFoundError(id);
      }

      this.runtime.log.info("Sub-agent deleted", { id });

      return true;
    });
  }
}
