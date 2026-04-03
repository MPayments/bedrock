import {
  ListSubAgentProfilesQuerySchema,
  type ListSubAgentProfilesQuery as ListSubAgentProfilesQueryInput,
} from "../contracts/queries";
import type { SubAgentProfileReads } from "../ports/sub-agent-profile.reads";

export class ListSubAgentProfilesQuery {
  constructor(private readonly reads: SubAgentProfileReads) {}

  async execute(input?: ListSubAgentProfilesQueryInput) {
    const query = ListSubAgentProfilesQuerySchema.parse(input ?? {});
    return this.reads.list(query);
  }
}
