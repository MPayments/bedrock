import { z } from "zod";

import type { AccountingReportingService } from "@bedrock/application/accounting-reporting";
import { BEDROCK_MODULE_MANIFESTS } from "@bedrock/application/module-runtime";
import type { FeesService } from "@bedrock/application/fees";
import type { FxService } from "@bedrock/application/fx";
import type { PaymentsService } from "@bedrock/application/payments";
import type { AccountingService } from "@bedrock/core/accounting";
import type { BalancesService } from "@bedrock/core/balances";
import {
  createModuleRuntimeService,
  type ModuleRuntimeService,
} from "@bedrock/core/module-runtime";
import type { CounterpartiesService } from "@bedrock/core/counterparties";
import { assertInternalLedgerInvariants } from "@bedrock/core/counterparties";
import type { CounterpartyAccountsService } from "@bedrock/core/counterparty-accounts";
import type { CurrenciesService } from "@bedrock/core/currencies";
import type { CustomersService } from "@bedrock/core/customers";
import type { DocumentsService } from "@bedrock/core/documents";
import type { LedgerReadService } from "@bedrock/core/ledger";
import type { ReconciliationService } from "@bedrock/core/reconciliation";
import { db } from "@bedrock/db/client";
import type { Logger } from "@bedrock/kernel";

import { createApplicationServices } from "./composition/application";
import { createCoreServices } from "./composition/core";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TB_ADDRESS: z.string().min(1, "TB_ADDRESS is required"),
  TB_CLUSTER_ID: z.coerce.number().int().nonnegative(),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .min(1, "BETTER_AUTH_TRUSTED_ORIGINS is required"),
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
  counterpartyAccountsService: CounterpartyAccountsService;
  accountingService: AccountingService;
  accountingReportingService: AccountingReportingService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  paymentsService: PaymentsService;
  ledgerReadService: LedgerReadService;
  balancesService: BalancesService;
  documentsService: DocumentsService;
  reconciliationService: ReconciliationService;
  moduleRuntime: ModuleRuntimeService;
  assertInternalLedgerInvariants: () => Promise<void>;
}

export function createAppContext(env: Env): AppContext {
  const core = createCoreServices();
  const moduleRuntime = createModuleRuntimeService({
    db,
    logger: core.logger,
    manifests: BEDROCK_MODULE_MANIFESTS,
  });
  const applicationServices = createApplicationServices(core);

  return {
    env,
    logger: core.logger,
    accountingService: core.accountingService,
    ledgerReadService: core.ledgerReadService,
    balancesService: core.balancesService,
    counterpartyAccountsService: applicationServices.counterpartyAccountsService,
    accountingReportingService: applicationServices.accountingReportingService,
    counterpartiesService: applicationServices.counterpartiesService,
    customersService: applicationServices.customersService,
    currenciesService: applicationServices.currenciesService,
    feesService: applicationServices.feesService,
    fxService: applicationServices.fxService,
    paymentsService: applicationServices.paymentsService,
    documentsService: applicationServices.documentsService,
    reconciliationService: applicationServices.reconciliationService,
    moduleRuntime,
    assertInternalLedgerInvariants: () => assertInternalLedgerInvariants(db),
  };
}
