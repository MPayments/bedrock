import "server-only";

import { createPostgresDatabase } from "@bedrock/platform/persistence/postgres";

import { deals } from "@bedrock/deals/schema";
import { user } from "@bedrock/iam/schema";

import { crmTasks } from "@/lib/server/tasks/schema";

const schema = {
  crmTasks,
  deals,
  user,
};

export const crmTasksDb = createPostgresDatabase({ schema });
