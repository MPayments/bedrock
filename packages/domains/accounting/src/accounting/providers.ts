import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import {
  adaptBedrockLogger,
  DbToken,
} from "@multihansa/common/bedrock";
import { createAccountingService } from "./runtime-service";

import {
  AccountingDomainServiceToken,
  AccountingPackDefinitionToken,
} from "./tokens";

export function createAccountingProviders(): Provider[] {
  return [
    defineProvider({
      provide: AccountingDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
        defaultPackDefinition: AccountingPackDefinitionToken,
      },
      useFactory: ({ db, logger, defaultPackDefinition }) =>
        createAccountingService({
          db,
          logger: adaptBedrockLogger(logger),
          defaultPackDefinition,
        }),
    }),
  ];
}
