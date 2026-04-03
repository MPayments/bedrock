import type { ModuleRuntime } from "@bedrock/shared/core";

import { SubAgentProfileNotFoundError } from "../errors";
import type { SubAgentProfilesCommandUnitOfWork } from "../ports/sub-agent-profiles.uow";

export class ArchiveSubAgentProfileCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly uow: SubAgentProfilesCommandUnitOfWork,
  ) {}

  async execute(counterpartyId: string): Promise<boolean> {
    return this.uow.run(async (tx) => {
      const archived = await tx.subAgentProfiles.update({
        counterpartyId,
        isActive: false,
      });

      if (!archived) {
        throw new SubAgentProfileNotFoundError(counterpartyId);
      }

      this.runtime.log.info("Sub-agent profile archived", {
        counterpartyId,
      });

      return true;
    });
  }
}
