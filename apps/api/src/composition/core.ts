import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/app/accounting";
import { rawPackDefinition } from "@bedrock/app/accounting/packs/bedrock-core-default";
import {
  createBalancesService,
  type BalancesService,
} from "@bedrock/app/balances";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerEngine,
  type LedgerReadService,
} from "@bedrock/app/ledger";
import {
  createUsersService,
  type UsersService,
} from "@bedrock/app/users";
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
