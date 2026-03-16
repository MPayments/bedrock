import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  RequisiteProvidersCommandRepository,
  RequisiteProvidersQueryRepository,
} from "../providers/ports";

export interface RequisiteProvidersServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface RequisiteProvidersServiceContext {
  db: Database;
  log: Logger;
  queries: RequisiteProvidersQueryRepository;
  commands: RequisiteProvidersCommandRepository;
}

export function createRequisiteProvidersServiceContext(input: {
  db: Database;
  logger?: Logger;
  queries: RequisiteProvidersQueryRepository;
  commands: RequisiteProvidersCommandRepository;
}): RequisiteProvidersServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "requisite-providers" }) ?? noopLogger,
    queries: input.queries,
    commands: input.commands,
  };
}
