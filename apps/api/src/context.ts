import type { AccountingService } from "@bedrock/accounting";
import type { AccountingReportingService } from "@bedrock/accounting-reporting";
import type { BalancesService } from "@bedrock/balances";
import type { CounterpartiesService } from "@bedrock/counterparties";
import type { CurrenciesService } from "@bedrock/currencies";
import type { CustomersService } from "@bedrock/customers";
import type { DocumentsService } from "@bedrock/documents";
import type { FeesService } from "@bedrock/fees";
import type { FxService } from "@bedrock/fx";
import type { Logger } from "@bedrock/kernel";
import type { LedgerReadService } from "@bedrock/ledger";
import type { OperationalAccountsService } from "@bedrock/operational-accounts";
import type { ReconciliationService } from "@bedrock/reconciliation";

import { createModuleServices } from "./composition/modules";
import { createPlatformServices } from "./composition/platform";

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
  balancesService: BalancesService;
  documentsService: DocumentsService;
  reconciliationService: ReconciliationService;
}

export function createAppContext(env: Env): AppContext {
  const platform = createPlatformServices();
  const modules = createModuleServices(platform);

  return {
    env,
    logger: platform.logger,
    accountingService: platform.accountingService,
    ledgerReadService: platform.ledgerReadService,
    balancesService: platform.balancesService,
    operationalAccountsService: modules.operationalAccountsService,
    accountingReportingService: modules.accountingReportingService,
    counterpartiesService: modules.counterpartiesService,
    customersService: modules.customersService,
    currenciesService: modules.currenciesService,
    feesService: modules.feesService,
    fxService: modules.fxService,
    documentsService: modules.documentsService,
    reconciliationService: modules.reconciliationService,
  };
}
