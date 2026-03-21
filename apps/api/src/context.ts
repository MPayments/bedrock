import { z } from "zod";

import type {
  AccountingReportsService,
  AccountingService,
} from "@bedrock/accounting";
import type { BalancesService } from "@bedrock/balances";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DocumentsService } from "@bedrock/documents";
import type { FeesService } from "@bedrock/fees";
import type { FxService } from "@bedrock/fx";
import type { LedgerReadService } from "@bedrock/ledger";
import type { PartiesModule } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { UsersService } from "@bedrock/users";
import type { DocumentDraftWorkflow } from "@bedrock/workflow-document-drafts";
import type { DocumentPostingWorkflow } from "@bedrock/workflow-document-posting";
import type { IntegrationEventHandler } from "@bedrock/workflow-integration-mpayments";
import type { OrganizationBootstrapWorkflow } from "@bedrock/workflow-organization-bootstrap";
import type { RequisiteAccountingWorkflow } from "@bedrock/workflow-requisite-accounting";

import { createApplicationServices } from "./composition/application";
import { createCoreServices } from "./composition/core";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TB_ADDRESS: z.string().min(1, "TB_ADDRESS is required"),
  TB_CLUSTER_ID: z.coerce.number().int().nonnegative(),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .min(1, "BETTER_AUTH_TRUSTED_ORIGINS is required"),
  MPAYMENTS_INTEGRATION_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  MPAYMENTS_INTEGRATION_USERNAME: z.string().optional(),
  MPAYMENTS_INTEGRATION_PASSWORD: z.string().optional(),
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
    MPAYMENTS_INTEGRATION_ENABLED: process.env.MPAYMENTS_INTEGRATION_ENABLED,
    MPAYMENTS_INTEGRATION_USERNAME: process.env.MPAYMENTS_INTEGRATION_USERNAME,
    MPAYMENTS_INTEGRATION_PASSWORD: process.env.MPAYMENTS_INTEGRATION_PASSWORD,
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
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
  usersService: UsersService;
  ledgerReadService: LedgerReadService;
  balancesService: BalancesService;
  documentsService: DocumentsService;
  documentDraftWorkflow: DocumentDraftWorkflow;
  documentPostingWorkflow: DocumentPostingWorkflow;
  integrationEventHandler: IntegrationEventHandler | null;
}

export function createAppContext(env: Env): AppContext {
  const core = createCoreServices();
  const applicationServices = createApplicationServices(core);

  const integrationEventHandler = env.MPAYMENTS_INTEGRATION_ENABLED
    ? applicationServices.integrationEventHandler
    : null;

  return {
    env,
    logger: core.logger,
    accountingService: core.accountingService,
    ledgerReadService: core.ledgerReadService,
    balancesService: core.balancesService,
    accountingReportsService: applicationServices.accountingReportsService,
    partiesModule: applicationServices.partiesModule,
    currenciesService: applicationServices.currenciesService,
    feesService: applicationServices.feesService,
    fxService: applicationServices.fxService,
    organizationBootstrapWorkflow:
      applicationServices.organizationBootstrapWorkflow,
    requisiteAccountingWorkflow:
      applicationServices.requisiteAccountingWorkflow,
    usersService: core.usersService,
    documentsService: applicationServices.documentsService,
    documentDraftWorkflow: applicationServices.documentDraftWorkflow,
    documentPostingWorkflow: applicationServices.documentPostingWorkflow,
    integrationEventHandler,
  };
}
