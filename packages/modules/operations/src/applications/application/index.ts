import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateApplicationCommand } from "./commands/create-application";
import { TakeApplicationCommand } from "./commands/take-application";
import { UpdateApplicationCommentCommand } from "./commands/update-application-comment";
import { UpdateApplicationStatusCommand } from "./commands/update-application-status";
import type { ApplicationReads } from "./ports/application.reads";
import type { ApplicationsCommandUnitOfWork } from "./ports/applications.uow";
import { FindApplicationByIdQuery } from "./queries/find-application-by-id";
import { ListApplicationsQuery } from "./queries/list-applications";

export interface ApplicationsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: ApplicationsCommandUnitOfWork;
  reads: ApplicationReads;
}

export function createApplicationsService(deps: ApplicationsServiceDeps) {
  const createApplication = new CreateApplicationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateStatus = new UpdateApplicationStatusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateComment = new UpdateApplicationCommentCommand(
    deps.runtime,
    deps.commandUow,
  );
  const takeApplication = new TakeApplicationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findById = new FindApplicationByIdQuery(deps.reads);
  const listApplications = new ListApplicationsQuery(deps.reads);

  return {
    commands: {
      create: createApplication.execute.bind(createApplication),
      updateStatus: updateStatus.execute.bind(updateStatus),
      updateComment: updateComment.execute.bind(updateComment),
      take: takeApplication.execute.bind(takeApplication),
    },
    queries: {
      findById: findById.execute.bind(findById),
      list: listApplications.execute.bind(listApplications),
      listUnassigned: deps.reads.listUnassigned.bind(deps.reads),
      countByClientId: deps.reads.countByClientId.bind(deps.reads),
    },
  };
}

export type ApplicationsService = ReturnType<typeof createApplicationsService>;
