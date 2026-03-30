import type { ModuleRuntime } from "@bedrock/shared/core";

import type { AgentProfileReads } from "./ports/agent-profile.reads";
import { FindAgentByIdQuery } from "./queries/find-agent-by-id";
import { ListAgentsQuery } from "./queries/list-agents";

export interface AgentsServiceDeps {
  reads: AgentProfileReads;
  runtime: ModuleRuntime;
}

export function createAgentsService(deps: AgentsServiceDeps) {
  const findById = new FindAgentByIdQuery(deps.reads);
  const listAgents = new ListAgentsQuery(deps.reads);

  return {
    queries: {
      findById: findById.execute.bind(findById),
      findByEmail: deps.reads.findByEmail.bind(deps.reads),
      list: listAgents.execute.bind(listAgents),
      listAllowed: deps.reads.listAllowed.bind(deps.reads),
    },
  };
}

export type AgentsService = ReturnType<typeof createAgentsService>;
