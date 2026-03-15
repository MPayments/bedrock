import { z } from "zod";

import type { FeesService } from "@bedrock/fees";
import type { FxService } from "@bedrock/fx";
import type { AccountingService } from "@bedrock/accounting";
import type { AccountingReportsService } from "@bedrock/accounting/reports";
import type { BalancesService } from "@bedrock/balances";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DocumentsService } from "@bedrock/documents";
import type { LedgerReadService } from "@bedrock/ledger";
import type { OrganizationsService } from "@bedrock/organizations";
import type { PartiesService } from "@bedrock/parties";
import type { RequisiteProvidersService } from "@bedrock/requisite-providers";
import type { UsersService } from "@bedrock/users";
import type { Logger } from "@bedrock/platform/observability/logger";

import { createApplicationServices } from "./composition/application";
import type { ApiRequisitesFacadeService } from "./composition/requisites-facade";
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
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${errors}`);
  }

  return result.data;
}

export interface AppContext {
  env: Env;
  logger: Logger;
  accountingService: AccountingService;
  accountingReportsService: AccountingReportsService;
  partiesService: PartiesService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  organizationsService: OrganizationsService;
  requisiteProvidersService: RequisiteProvidersService;
  requisitesFacadeService: ApiRequisitesFacadeService;
  usersService: UsersService;
  ledgerReadService: LedgerReadService;
  balancesService: BalancesService;
  documentsService: DocumentsService;
}

export function createAppContext(env: Env): AppContext {
  const core = createCoreServices();
  const applicationServices = createApplicationServices(core);

  return {
    env,
    logger: core.logger,
    accountingService: core.accountingService,
    ledgerReadService: core.ledgerReadService,
    balancesService: core.balancesService,
    accountingReportsService: applicationServices.accountingReportsService,
    partiesService: applicationServices.partiesService,
    currenciesService: applicationServices.currenciesService,
    feesService: applicationServices.feesService,
    fxService: applicationServices.fxService,
    organizationsService: applicationServices.organizationsService,
    requisiteProvidersService: applicationServices.requisiteProvidersService,
    requisitesFacadeService: applicationServices.requisitesFacadeService,
    usersService: core.usersService,
    documentsService: applicationServices.documentsService,
  };
}
