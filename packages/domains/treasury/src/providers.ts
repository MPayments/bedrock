import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import { CurrenciesDomainServiceToken } from "@multihansa/assets";
import { adaptBedrockLogger } from "@multihansa/common/bedrock";
import { DocumentsDomainServiceToken } from "@multihansa/documents";
import { DbToken } from "@multihansa/common/bedrock";

import { createFeesService } from "./fees/service";
import { createFxService } from "./fx/service";
import { createPaymentsService } from "./payments/runtime";
import {
  FeesDomainServiceToken,
  FxDomainServiceToken,
  PaymentsDomainServiceToken,
} from "./tokens";

export function createTreasuryFxBedrockProviders(): Provider[] {
  return [
    defineProvider({
      provide: FeesDomainServiceToken,
      scope: "singleton",
      deps: {
        currenciesService: CurrenciesDomainServiceToken,
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ currenciesService, db, logger }) =>
        createFeesService({
          currenciesService,
          db,
          logger: adaptBedrockLogger(logger),
        }),
    }),
    defineProvider({
      provide: FxDomainServiceToken,
      scope: "singleton",
      deps: {
        currenciesService: CurrenciesDomainServiceToken,
        db: DbToken,
        feesService: FeesDomainServiceToken,
        logger: LoggerToken,
      },
      useFactory: ({ currenciesService, db, feesService, logger }) =>
        createFxService({
          currenciesService,
          db,
          feesService,
          logger: adaptBedrockLogger(logger),
        }),
    }),
  ];
}

export function createTreasuryPaymentsBedrockProviders(): Provider[] {
  return [
    defineProvider({
      provide: PaymentsDomainServiceToken,
      scope: "singleton",
      deps: {
        documents: DocumentsDomainServiceToken,
        logger: LoggerToken,
      },
      useFactory: ({ documents, logger }) =>
        createPaymentsService({
          documents,
          logger: adaptBedrockLogger(logger),
        }),
    }),
  ];
}

export function createTreasuryBedrockProviders(): Provider[] {
  return [
    ...createTreasuryFxBedrockProviders(),
    ...createTreasuryPaymentsBedrockProviders(),
  ];
}
