import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import {
  createAgreementsService,
  type AgreementsService,
} from "./application";
import type { AgreementReads } from "./application/ports/agreement.reads";
import type { AgreementsCommandUnitOfWork } from "./application/ports/agreements.uow";
import type { AgreementReferencesPort } from "./application/ports/references.port";

export interface AgreementsModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;
  idempotency: IdempotencyPort;
  reads: AgreementReads;
  references: AgreementReferencesPort;
  commandUow: AgreementsCommandUnitOfWork;
}

export interface AgreementsModule {
  agreements: AgreementsService;
}

export function createAgreementsModule(
  deps: AgreementsModuleDeps,
): AgreementsModule {
  return {
    agreements: createAgreementsService({
      commandUow: deps.commandUow,
      idempotency: deps.idempotency,
      reads: deps.reads,
      references: deps.references,
      runtime: createModuleRuntime({
        logger: deps.logger,
        now: deps.now,
        generateUuid: deps.generateUuid,
        service: "agreements",
      }),
    }),
  };
}
