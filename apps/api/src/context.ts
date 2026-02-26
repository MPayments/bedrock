import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/accounting";
import { createAccountService, type AccountService } from "@bedrock/accounts";
import {
  createCounterpartiesService,
  type CounterpartiesService,
} from "@bedrock/counterparties";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import {
  createCustomersService,
  type CustomersService,
} from "@bedrock/customers";
import { db } from "@bedrock/db/client";
import { seedAccounting } from "@bedrock/db/seeds";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createConsoleLogger, type Logger } from "@bedrock/kernel";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerReadService,
} from "@bedrock/ledger";
import {
  createTransfersService,
  type TransfersService,
} from "@bedrock/transfers";

export interface Env {
  DATABASE_URL: string;
  TB_ADDRESS: string;
  TB_CLUSTER_ID: number;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS: string;
}

export interface AppContext {
  env: Env;
  logger: Logger;
  accountService: AccountService;
  accountingService: AccountingService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  ledgerReadService: LedgerReadService;
  transfersService: TransfersService;
}

export function createAppContext(env: Env): AppContext {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const accountService = createAccountService({ db, logger });
  const accountingService = createAccountingService({ db, logger });
  const counterpartiesService = createCounterpartiesService({ db, logger });
  const customersService = createCustomersService({ db, logger });
  const currenciesService = createCurrenciesService({ db, logger });
  const ledger = createLedgerEngine({ db });
  const feesService = createFeesService({ db, logger, currenciesService });
  const fxService = createFxService({
    db,
    logger,
    feesService,
    currenciesService,
  });
  const ledgerReadService = createLedgerReadService({ db });
  const transfersService = createTransfersService({
    db,
    ledger,
    accountService,
    logger,
  });

  void seedAccounting(db).catch((error) => {
    logger.error("Failed to seed accounting defaults", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return {
    env,
    logger,
    accountService,
    accountingService,
    counterpartiesService,
    customersService,
    currenciesService,
    feesService,
    fxService,
    ledgerReadService,
    transfersService,
  };
}
