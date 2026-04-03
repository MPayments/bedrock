import { SubAgentProfileNotFoundError } from "../errors";
import type { SubAgentProfileReads } from "../ports/sub-agent-profile.reads";

export class FindSubAgentProfileByIdQuery {
  constructor(private readonly reads: SubAgentProfileReads) {}

  async execute(counterpartyId: string) {
    const subAgentProfile = await this.reads.findById(counterpartyId);
    if (!subAgentProfile) {
      throw new SubAgentProfileNotFoundError(counterpartyId);
    }

    return subAgentProfile;
  }
}
