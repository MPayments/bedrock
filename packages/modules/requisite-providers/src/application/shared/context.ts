import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type { RequisiteProvidersRepository } from "../ports";

export interface RequisiteProvidersServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface RequisiteProvidersServiceContext {
  db: Database;
  log: Logger;
  providers: RequisiteProvidersRepository;
}

export function createRequisiteProvidersServiceContext(input: {
  db: Database;
  logger?: Logger;
  providers: RequisiteProvidersRepository;
}): RequisiteProvidersServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "requisite-providers" }) ?? noopLogger,
    providers: input.providers,
  };
}
