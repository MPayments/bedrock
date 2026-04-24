import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import {
  createCalculationsService,
  type CalculationsService,
} from "./application";
import type { CalculationReads } from "./application/ports/calculation.reads";
import type { CalculationsCommandUnitOfWork } from "./application/ports/calculations.uow";
import type { CalculationReferencesPort } from "./application/ports/references.port";

export interface CalculationsModuleDeps {
  commandUow: CalculationsCommandUnitOfWork;
  generateUuid: UuidGenerator;
  logger: Logger;
  now: Clock;
  reads: CalculationReads;
  references: CalculationReferencesPort;
}

export interface CalculationsModule {
  calculations: CalculationsService;
}

export function createCalculationsModule(
  deps: CalculationsModuleDeps,
): CalculationsModule {
  return {
    calculations: createCalculationsService({
      commandUow: deps.commandUow,
      reads: deps.reads,
      references: deps.references,
      runtime: createModuleRuntime({
        logger: deps.logger,
        now: deps.now,
        generateUuid: deps.generateUuid,
        service: "calculations",
      }),
    }),
  };
}
