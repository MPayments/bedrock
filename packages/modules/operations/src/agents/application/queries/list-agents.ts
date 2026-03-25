import {
  ListAgentsQuerySchema,
  type ListAgentsQuery as ListAgentsQueryInput,
} from "../contracts/queries";
import type { AgentProfileReads } from "../ports/agent-profile.reads";

export class ListAgentsQuery {
  constructor(private readonly reads: AgentProfileReads) {}

  async execute(input?: ListAgentsQueryInput) {
    const query = ListAgentsQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
