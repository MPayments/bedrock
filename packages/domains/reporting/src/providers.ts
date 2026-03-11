import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import {
  adaptBedrockLogger,
  DbToken,
} from "@multihansa/common/bedrock";
import { LedgerReadServiceToken } from "@multihansa/ledger";

import { createAccountingReportingService } from "./accounting-reporting/runtime";
import {
  AccountingReportingDomainServiceToken,
  DimensionRegistryToken,
} from "./tokens";

export function createReportingBedrockProviders(): Provider[] {
  return [
    defineProvider({
      provide: AccountingReportingDomainServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
        logger: LoggerToken,
        ledgerReadService: LedgerReadServiceToken,
        dimensionRegistry: DimensionRegistryToken,
      },
      useFactory: ({ db, logger, ledgerReadService, dimensionRegistry }) =>
        createAccountingReportingService({
          db,
          logger: adaptBedrockLogger(logger),
          ledgerReadService,
          dimensionRegistry,
        }),
    }),
  ];
}
