import type { IdempotencyPort } from "@bedrock/platform/idempotency";
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
import {
  createPaymentRoutesService,
  type PaymentRoutesService,
} from "./route-templates/application";
import type {
  RouteTemplateCrossRateLookup,
  RouteTemplateCurrenciesPort,
} from "./route-templates/application/ports/external-ports";
import type { PaymentRouteTemplatesRepository } from "./route-templates/application/ports/payment-routes.repository";

export interface CalculationsModuleDeps {
  commandUow: CalculationsCommandUnitOfWork;
  currencies: RouteTemplateCurrenciesPort;
  generateUuid: UuidGenerator;
  getCrossRate: RouteTemplateCrossRateLookup;
  idempotency: IdempotencyPort;
  logger: Logger;
  now: Clock;
  reads: CalculationReads;
  references: CalculationReferencesPort;
  routeTemplatesRepository: PaymentRouteTemplatesRepository;
}

export interface CalculationsModule {
  calculations: CalculationsService;
  routeTemplates: PaymentRoutesService;
}

export function createCalculationsModule(
  deps: CalculationsModuleDeps,
): CalculationsModule {
  return {
    calculations: createCalculationsService({
      commandUow: deps.commandUow,
      idempotency: deps.idempotency,
      reads: deps.reads,
      references: deps.references,
      runtime: createModuleRuntime({
        logger: deps.logger,
        now: deps.now,
        generateUuid: deps.generateUuid,
        service: "calculations",
      }),
    }),
    routeTemplates: createPaymentRoutesService({
      currencies: deps.currencies,
      getCrossRate: deps.getCrossRate,
      repository: deps.routeTemplatesRepository,
      runtime: createModuleRuntime({
        logger: deps.logger,
        now: deps.now,
        generateUuid: deps.generateUuid,
        service: "calculations.route_templates",
      }),
    }),
  };
}
