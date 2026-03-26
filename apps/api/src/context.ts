import { z } from "zod";

import type { AccountingModule } from "@bedrock/accounting";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DocumentsService } from "@bedrock/documents";
import type { LedgerModule } from "@bedrock/ledger";
import type { OperationsModule } from "@bedrock/operations";
import type { PartiesModule } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { TreasuryModule } from "@bedrock/treasury";
import type { UsersService } from "@bedrock/users";
import type { CustomerPortalWorkflow } from "@bedrock/workflow-customer-portal";
import type { DocumentDraftWorkflow } from "@bedrock/workflow-document-drafts";
import type { DocumentGenerationWorkflow } from "@bedrock/workflow-document-generation";
import type { DocumentPostingWorkflow } from "@bedrock/workflow-document-posting";
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

  // Operations adapters (all optional — graceful degradation)
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default("bedrock-documents"),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("noreply@bedrock.app"),
  DADATA_API_URL: z.string().default("https://dadata.tbank.ru"),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

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
  accountingModule: AccountingModule;
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  treasuryModule: TreasuryModule;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
  usersService: UsersService;
  ledgerModule: LedgerModule;
  documentsService: DocumentsService;
  documentDraftWorkflow: DocumentDraftWorkflow;
  documentPostingWorkflow: DocumentPostingWorkflow;
  operationsModule: OperationsModule;
  customerPortalWorkflow: CustomerPortalWorkflow;
  documentGenerationWorkflow: DocumentGenerationWorkflow;
}

export function createAppContext(env: Env): AppContext {
  const core = createCoreServices();
  const applicationServices = createApplicationServices(core, env);

  return {
    env,
    logger: core.logger,
    accountingModule: core.accountingModule,
    ledgerModule: core.ledgerModule,
    partiesModule: applicationServices.partiesModule,
    currenciesService: applicationServices.currenciesService,
    treasuryModule: applicationServices.treasuryModule,
    organizationBootstrapWorkflow:
      applicationServices.organizationBootstrapWorkflow,
    requisiteAccountingWorkflow:
      applicationServices.requisiteAccountingWorkflow,
    usersService: core.usersService,
    documentsService: applicationServices.documentsService,
    documentDraftWorkflow: applicationServices.documentDraftWorkflow,
    documentPostingWorkflow: applicationServices.documentPostingWorkflow,
    operationsModule: applicationServices.operationsModule,
    customerPortalWorkflow: applicationServices.customerPortalWorkflow,
    documentGenerationWorkflow: applicationServices.documentGenerationWorkflow,
  };
}
