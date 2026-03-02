import { db } from "@bedrock/db/client";
import { createConsoleLogger, type Logger } from "@bedrock/foundation/kernel";
import { rawPackDefinition } from "@bedrock/foundation/packs/bedrock-core-default";
import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/platform/accounting";
import {
  createBalancesService,
  type BalancesService,
} from "@bedrock/platform/balances";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerEngine,
  type LedgerReadService,
} from "@bedrock/platform/ledger";

export interface ApiPlatformServices {
  logger: Logger;
  accountingService: AccountingService;
  balancesService: BalancesService;
  ledger: LedgerEngine;
  ledgerReadService: LedgerReadService;
}

export function createPlatformServices(): ApiPlatformServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const accountingService = createAccountingService({
    db,
    logger,
    defaultPackDefinition: rawPackDefinition,
  });
  const ledger = createLedgerEngine({ db });
  const ledgerReadService = createLedgerReadService({ db });
  const balancesService = createBalancesService({ db, logger });

  return {
    logger,
    accountingService,
    balancesService,
    ledger,
    ledgerReadService,
  };
}
