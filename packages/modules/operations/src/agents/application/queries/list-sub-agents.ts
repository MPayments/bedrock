import {
  ListSubAgentsQuerySchema,
  type ListSubAgentsQuery as ListSubAgentsQueryInput,
} from "../contracts/sub-agent-queries";
import type { SubAgentReads } from "../ports/sub-agent.reads";

export class ListSubAgentsQuery {
  constructor(private readonly reads: SubAgentReads) {}

  async execute(input?: ListSubAgentsQueryInput) {
    const query = ListSubAgentsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
