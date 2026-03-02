import type { AccountingService } from "@bedrock/accounting";
import type { AccountingReportingService } from "@bedrock/accounting-reporting";
import type { BalancesService } from "@bedrock/balances";
import type { ConnectorsService } from "@bedrock/connectors";
import type { CounterpartiesService } from "@bedrock/counterparties";
import type { CurrenciesService } from "@bedrock/currencies";
import type { CustomersService } from "@bedrock/customers";
import { db } from "@bedrock/db/client";
import type { DocumentsService } from "@bedrock/documents";
import type { FeesService } from "@bedrock/fees";
import type { FxService } from "@bedrock/fx";
import type { Logger } from "@bedrock/foundation/kernel";
import type { LedgerReadService } from "@bedrock/ledger";
import {
  BEDROCK_COMPONENT_MANIFESTS,
  createComponentRuntimeService,
  type ComponentRuntimeService,
} from "@bedrock/component-runtime";
import type { OperationalAccountsService } from "@bedrock/operational-accounts";
import type { OrchestrationService } from "@bedrock/orchestration";
import type { PaymentsService } from "@bedrock/payments";
import type { ReconciliationService } from "@bedrock/reconciliation";
import { z } from "zod";

import { createModuleServices } from "./composition/modules";
import { createPlatformServices } from "./composition/platform";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TB_ADDRESS: z.string().min(1, "TB_ADDRESS is required"),
  TB_CLUSTER_ID: z.coerce.number().int().nonnegative(),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().min(1, "BETTER_AUTH_TRUSTED_ORIGINS is required"),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(): Env {
  const result = EnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    TB_ADDRESS: process.env.TB_ADDRESS,
    TB_CLUSTER_ID: process.env.TB_CLUSTER_ID,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${errors}`);
  }

  return result.data;
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
  connectorsService: ConnectorsService;
  orchestrationService: OrchestrationService;
  paymentsService: PaymentsService;
  ledgerReadService: LedgerReadService;
  balancesService: BalancesService;
  documentsService: DocumentsService;
  reconciliationService: ReconciliationService;
  componentRuntime: ComponentRuntimeService;
}

export function createAppContext(env: Env): AppContext {
  const platform = createPlatformServices();
  const componentRuntime = createComponentRuntimeService({
    db,
    logger: platform.logger,
    manifests: BEDROCK_COMPONENT_MANIFESTS,
  });
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
    connectorsService: modules.connectorsService,
    orchestrationService: modules.orchestrationService,
    paymentsService: modules.paymentsService,
    documentsService: modules.documentsService,
    reconciliationService: modules.reconciliationService,
    componentRuntime,
  };
}
