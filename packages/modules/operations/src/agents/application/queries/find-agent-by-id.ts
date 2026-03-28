import { AgentNotFoundError } from "../../../errors";
import type { AgentProfileReads } from "../ports/agent-profile.reads";

export class FindAgentByIdQuery {
  constructor(private readonly reads: AgentProfileReads) {}

  async execute(id: string) {
    const agent = await this.reads.findById(id);
    if (!agent) {
      throw new AgentNotFoundError(id);
    }
    return agent;
  }
}
