import type { ModuleRuntime } from "@bedrock/shared/core";

import { LogActivityCommand } from "./commands/log-activity";
import type { ActivityLogReads } from "./ports/activity-log.reads";
import type { ActivityLogStore } from "./ports/activity-log.store";
import { ListActivitiesQuery } from "./queries/list-activities";

export interface ActivityLogServiceDeps {
  runtime: ModuleRuntime;
  store: ActivityLogStore;
  reads: ActivityLogReads;
}

export function createActivityLogService(deps: ActivityLogServiceDeps) {
  const logActivity = new LogActivityCommand(deps.runtime, deps.store);
  const listActivities = new ListActivitiesQuery(deps.reads);

  return {
    commands: {
      log: logActivity.execute.bind(logActivity),
    },
    queries: {
      list: listActivities.execute.bind(listActivities),
    },
  };
}

export type ActivityLogService = ReturnType<typeof createActivityLogService>;
