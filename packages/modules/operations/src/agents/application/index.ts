import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateSubAgentCommand } from "./commands/create-sub-agent";
import { DeleteSubAgentCommand } from "./commands/delete-sub-agent";
import { UpdateSubAgentCommand } from "./commands/update-sub-agent";
import type { AgentProfileReads } from "./ports/agent-profile.reads";
import type { SubAgentReads } from "./ports/sub-agent.reads";
import type { SubAgentsCommandUnitOfWork } from "./ports/sub-agents.uow";
import { FindAgentByIdQuery } from "./queries/find-agent-by-id";
import { FindSubAgentByIdQuery } from "./queries/find-sub-agent-by-id";
import { ListAgentsQuery } from "./queries/list-agents";
import { ListSubAgentsQuery } from "./queries/list-sub-agents";

export interface AgentsServiceDeps {
  reads: AgentProfileReads;
  subAgentReads: SubAgentReads;
  subAgentUow: SubAgentsCommandUnitOfWork;
  runtime: ModuleRuntime;
}

export function createAgentsService(deps: AgentsServiceDeps) {
  const findById = new FindAgentByIdQuery(deps.reads);
  const listAgents = new ListAgentsQuery(deps.reads);

  const createSubAgent = new CreateSubAgentCommand(
    deps.runtime,
    deps.subAgentUow,
  );
  const updateSubAgent = new UpdateSubAgentCommand(
    deps.runtime,
    deps.subAgentUow,
  );
  const deleteSubAgent = new DeleteSubAgentCommand(
    deps.runtime,
    deps.subAgentUow,
  );
  const findSubAgentById = new FindSubAgentByIdQuery(deps.subAgentReads);
  const listSubAgents = new ListSubAgentsQuery(deps.subAgentReads);

  return {
    queries: {
      findById: findById.execute.bind(findById),
      findByEmail: deps.reads.findByEmail.bind(deps.reads),
      list: listAgents.execute.bind(listAgents),
      listAllowed: deps.reads.listAllowed.bind(deps.reads),
    },
    subAgents: {
      commands: {
        create: createSubAgent.execute.bind(createSubAgent),
        update: updateSubAgent.execute.bind(updateSubAgent),
        remove: deleteSubAgent.execute.bind(deleteSubAgent),
      },
      queries: {
        findById: findSubAgentById.execute.bind(findSubAgentById),
        list: listSubAgents.execute.bind(listSubAgents),
      },
    },
  };
}

export type AgentsService = ReturnType<typeof createAgentsService>;
