import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/accounting";
import {
  createAccountingReportingService,
  type AccountingReportingService,
} from "@bedrock/accounting-reporting";
import { createOperationalAccountsService, type OperationalAccountsService } from "@bedrock/operational-accounts";
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
import { createTreasuryService, type TreasuryService } from "@bedrock/treasury";

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
  operationalAccountsService: OperationalAccountsService;
  accountingService: AccountingService;
  accountingReportingService: AccountingReportingService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  ledgerReadService: LedgerReadService;
  treasuryService: TreasuryService;
  transfersService: TransfersService;
}

export function createAppContext(env: Env): AppContext {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const operationalAccountsService = createOperationalAccountsService({ db, logger });
  const accountingService = createAccountingService({ db, logger });
  const accountingReportingService = createAccountingReportingService({
    db,
    logger,
  });
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
  const treasuryService = createTreasuryService({
    db,
    ledger,
    feesService,
    currenciesService,
    logger,
  });
  const transfersService = createTransfersService({
    db,
    ledger,
    operationalAccountsService,
    logger,
  });

  return {
    env,
    logger,
    operationalAccountsService,
    accountingService,
    accountingReportingService,
    counterpartiesService,
    customersService,
    currenciesService,
    feesService,
    fxService,
    ledgerReadService,
    treasuryService,
    transfersService,
  };
}
