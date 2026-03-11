import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import {
  adaptBedrockLogger,
  DbToken,
} from "@multihansa/common/bedrock";
import { createCurrenciesService } from "./runtime";

import { CurrenciesDomainServiceToken } from "./tokens";

export function createAssetsProviders(): Provider[] {
  return [
    defineProvider({
      provide: CurrenciesDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
      },
      useFactory: ({ db, logger }) =>
        createCurrenciesService({
          db,
          logger: adaptBedrockLogger(logger),
        }),
    }),
  ];
}
