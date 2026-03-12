import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/application/accounting";
import { rawPackDefinition } from "@bedrock/application/accounting/packs/bedrock-core-default";
import {
  createBalancesService,
  type BalancesService,
} from "@bedrock/application/balances";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerEngine,
  type LedgerReadService,
} from "@bedrock/application/ledger";
import {
  createUsersService,
  type UsersService,
} from "@bedrock/application/users";
import { createConsoleLogger, type Logger } from "@bedrock/common";
import { db } from "@bedrock/db/client";

export interface ApiCoreServices {
  logger: Logger;
  accountingService: AccountingService;
  balancesService: BalancesService;
  ledger: LedgerEngine;
  ledgerReadService: LedgerReadService;
  usersService: UsersService;
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
  const usersService = createUsersService({ db, logger });

  return {
    logger,
    accountingService,
    balancesService,
    ledger,
    ledgerReadService,
    usersService,
  };
}
