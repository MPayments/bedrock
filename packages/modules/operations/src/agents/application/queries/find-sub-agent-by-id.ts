import { SubAgentNotFoundError } from "../../../errors";
import type { SubAgentReads } from "../ports/sub-agent.reads";

export class FindSubAgentByIdQuery {
  constructor(private readonly reads: SubAgentReads) {}

  async execute(id: number) {
    const subAgent = await this.reads.findById(id);
    if (!subAgent) {
      throw new SubAgentNotFoundError(id);
    }
    return subAgent;
  }
}
