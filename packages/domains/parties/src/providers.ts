import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import {
  adaptBedrockLogger,
  DbToken,
} from "@multihansa/common/bedrock";
import { createCounterpartiesService } from "./counterparties/runtime";
import { createCustomersService } from "./customers/runtime";
import { createOrganizationsService } from "./organizations/runtime";
import { createRequisiteProvidersService } from "./requisite-providers/runtime";
import { createRequisitesService } from "./requisites/runtime";

import {
  CounterpartiesDomainServiceToken,
  CustomersDomainServiceToken,
  OrganizationsDomainServiceToken,
  RequisiteProvidersDomainServiceToken,
  RequisitesDomainServiceToken,
} from "./tokens";

export function createPartiesBedrockProviders(): Provider[] {
  return [
    defineProvider({
      provide: CounterpartiesDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ db, logger }) =>
        createCounterpartiesService({
          db,
          logger: adaptBedrockLogger(logger),
        }),
    }),
    defineProvider({
      provide: CustomersDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ db, logger }) =>
        createCustomersService({
          db,
          logger: adaptBedrockLogger(logger),
        }),
    }),
    defineProvider({
      provide: OrganizationsDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ db, logger }) =>
        createOrganizationsService({
          db,
          logger: adaptBedrockLogger(logger),
        }),
    }),
    defineProvider({
      provide: RequisiteProvidersDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ db, logger }) =>
        createRequisiteProvidersService({
          db,
          logger: adaptBedrockLogger(logger),
        }),
    }),
    defineProvider({
      provide: RequisitesDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ db, logger }) =>
        createRequisitesService({
          db,
          logger: adaptBedrockLogger(logger),
        }),
    }),
  ];
}
