import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import {
  createDealsService,
  type DealsService,
} from "./application";
import type { DealReads } from "./application/ports/deal.reads";
import type { DealsCommandUnitOfWork } from "./application/ports/deals.uow";
import type { DealReferencesPort } from "./application/ports/references.port";

export interface DealsModuleDeps {
  commandUow: DealsCommandUnitOfWork;
  generateUuid: UuidGenerator;
  idempotency: IdempotencyPort;
  logger: Logger;
  now: Clock;
  reads: DealReads;
  references: DealReferencesPort;
}

export interface DealsModule {
  deals: DealsService;
}

export function createDealsModule(deps: DealsModuleDeps): DealsModule {
  return {
    deals: createDealsService({
      commandUow: deps.commandUow,
      idempotency: deps.idempotency,
      reads: deps.reads,
      references: deps.references,
      runtime: createModuleRuntime({
        logger: deps.logger,
        now: deps.now,
        generateUuid: deps.generateUuid,
        service: "deals",
      }),
    }),
  };
}
