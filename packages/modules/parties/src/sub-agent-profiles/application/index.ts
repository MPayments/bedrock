import type { ModuleRuntime } from "@bedrock/shared/core";

import { ArchiveSubAgentProfileCommand } from "./commands/archive-sub-agent-profile";
import { CreateSubAgentProfileCommand } from "./commands/create-sub-agent-profile";
import { UpdateSubAgentProfileCommand } from "./commands/update-sub-agent-profile";
import type { SubAgentProfileReads } from "./ports/sub-agent-profile.reads";
import type { SubAgentProfilesCommandUnitOfWork } from "./ports/sub-agent-profiles.uow";
import { FindSubAgentProfileByIdQuery } from "./queries/find-sub-agent-profile-by-id";
import { ListSubAgentProfilesQuery } from "./queries/list-sub-agent-profiles";

export interface SubAgentProfilesServiceDeps {
  commandUow: SubAgentProfilesCommandUnitOfWork;
  runtime: ModuleRuntime;
  reads: SubAgentProfileReads;
}

export function createSubAgentProfilesService(
  deps: SubAgentProfilesServiceDeps,
) {
  const createSubAgentProfile = new CreateSubAgentProfileCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateSubAgentProfile = new UpdateSubAgentProfileCommand(
    deps.runtime,
    deps.commandUow,
  );
  const archiveSubAgentProfile = new ArchiveSubAgentProfileCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findSubAgentProfileById = new FindSubAgentProfileByIdQuery(deps.reads);
  const listSubAgentProfiles = new ListSubAgentProfilesQuery(deps.reads);

  return {
    commands: {
      create: createSubAgentProfile.execute.bind(createSubAgentProfile),
      update: updateSubAgentProfile.execute.bind(updateSubAgentProfile),
      remove: archiveSubAgentProfile.execute.bind(archiveSubAgentProfile),
    },
    queries: {
      findById: findSubAgentProfileById.execute.bind(findSubAgentProfileById),
      list: listSubAgentProfiles.execute.bind(listSubAgentProfiles),
    },
  };
}

export type SubAgentProfilesService = ReturnType<
  typeof createSubAgentProfilesService
>;
