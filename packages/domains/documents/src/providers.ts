import { defineProvider, LoggerToken, type Provider } from "@bedrock/core";
import {
  adaptBedrockLogger,
  DbToken,
} from "@multihansa/common/bedrock";
import { AccountingDomainServiceToken } from "@multihansa/accounting";
import {
  LedgerEngineToken,
  LedgerReadServiceToken,
} from "@multihansa/ledger";

import { createDocumentsService } from "./runtime";
import {
  DocumentRegistryToken,
  DocumentsDomainServiceToken,
} from "./tokens";

export function createDocumentsProviders(): Provider[] {
  return [
    defineProvider({
      provide: DocumentsDomainServiceToken,
      scope: "singleton",
      deps: {
        accounting: AccountingDomainServiceToken,
        db: DbToken,
        ledger: LedgerEngineToken,
        ledgerReadService: LedgerReadServiceToken,
        logger: LoggerToken,
        registry: DocumentRegistryToken,
      },
      useFactory: ({
        accounting,
        db,
        ledger,
        ledgerReadService,
        logger,
        registry,
      }) =>
        createDocumentsService({
          accounting,
          db,
          ledger,
          ledgerReadService,
          logger: adaptBedrockLogger(logger),
          registry,
        }),
    }),
  ];
}
