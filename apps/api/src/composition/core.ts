import { db } from "@bedrock/db/client";
import { createConsoleLogger, type Logger } from "@bedrock/kernel";
import { rawPackDefinition } from "@bedrock/kernel/packs/bedrock-core-default";
import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/core/accounting";
import {
  createBalancesService,
  type BalancesService,
} from "@bedrock/core/balances";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerEngine,
  type LedgerReadService,
} from "@bedrock/core/ledger";

export interface ApiCoreServices {
  logger: Logger;
  accountingService: AccountingService;
  balancesService: BalancesService;
  ledger: LedgerEngine;
  ledgerReadService: LedgerReadService;
}

export function createCoreServices(): ApiCoreServices {
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
