import { z } from "zod";

import type { AccountingModule } from "@bedrock/accounting";
import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type { DocumentsService } from "@bedrock/documents";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import type { IamService } from "@bedrock/iam";
import type { PortalAccessGrantsService } from "@bedrock/iam";
import type { LedgerModule } from "@bedrock/ledger";
import type { PartiesModule } from "@bedrock/parties";
import type { DocumentExtractionPort } from "@bedrock/platform/ai";
import type { IdempotencyService } from "@bedrock/platform/idempotency-postgres";
import type { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  PersistenceContext,
  Transaction,
} from "@bedrock/platform/persistence";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";
import type { CustomerPortalWorkflow } from "@bedrock/workflow-customer-portal";
import type { DealAttachmentIngestionWorkflow } from "@bedrock/workflow-deal-attachment-ingestion";
import type { DealExecutionWorkflow } from "@bedrock/workflow-deal-execution";
import type { DealProjectionsWorkflow } from "@bedrock/workflow-deal-projections";
import type { DocumentDraftWorkflow } from "@bedrock/workflow-document-drafts";
import type { DocumentGenerationWorkflow } from "@bedrock/workflow-document-generation";
import type { DocumentPostingWorkflow } from "@bedrock/workflow-document-posting";
import type { OrganizationBootstrapWorkflow } from "@bedrock/workflow-organization-bootstrap";
import type { ReconciliationAdjustmentsWorkflow } from "@bedrock/workflow-reconciliation-adjustments";
import type { RequisiteAccountingWorkflow } from "@bedrock/workflow-requisite-accounting";

import { createApplicationServices } from "./composition/application";
import { createCoreServices } from "./composition/core";
import type { DealPricingWorkflow } from "./composition/deal-pricing-workflow";
import type { DealQuoteWorkflow } from "./composition/deal-quote-workflow";
import type { ApiPartiesReadRuntime } from "./composition/parties-module";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TB_ADDRESS: z.string().min(1, "TB_ADDRESS is required"),
  TB_CLUSTER_ID: z.coerce.number().int().nonnegative(),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z
    .url("BETTER_AUTH_URL must be a valid URL")
    .optional(),
  BETTER_AUTH_CRM_URL: z
    .url("BETTER_AUTH_CRM_URL must be a valid URL")
    .optional(),
  BETTER_AUTH_FINANCE_URL: z
    .url("BETTER_AUTH_FINANCE_URL must be a valid URL")
    .optional(),
  BETTER_AUTH_PORTAL_URL: z
    .url("BETTER_AUTH_PORTAL_URL must be a valid URL")
    .optional(),
  BETTER_AUTH_TRUSTED_ORIGINS: z
    .string()
    .min(1, "BETTER_AUTH_TRUSTED_ORIGINS is required"),

  // Operations adapters (all optional — graceful degradation)
  S3_ENDPOINT: z.string().optional(),
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default("bedrock-documents"),
  OPENAI_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("noreply@bedrock.app"),
  DADATA_API_URL: z.string().default("https://www.tbank.ru/business/contractor/company-pages/papi/dadata/suggestions/api/4_1/rs/suggest"),
  DADATA_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
}).superRefine((env, ctx) => {
  const hasSharedBaseUrl = typeof env.BETTER_AUTH_URL === "string";
  const hasAudienceBaseUrls =
    typeof env.BETTER_AUTH_CRM_URL === "string" &&
    typeof env.BETTER_AUTH_FINANCE_URL === "string" &&
    typeof env.BETTER_AUTH_PORTAL_URL === "string";

  if (hasSharedBaseUrl || hasAudienceBaseUrls) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message:
      "Set BETTER_AUTH_URL or all of BETTER_AUTH_CRM_URL, BETTER_AUTH_FINANCE_URL, BETTER_AUTH_PORTAL_URL.",
    path: ["BETTER_AUTH_URL"],
  });
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
  idempotency: IdempotencyService;
  persistence: PersistenceContext;
  accountingModule: AccountingModule;
  agreementsModule: AgreementsModule;
  calculationsModule: CalculationsModule;
  dealsModule: DealsModule;
  filesModule: FilesModule;
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  treasuryModule: TreasuryModule;
  createDealsModule(tx: Transaction): DealsModule;
  createTreasuryModule(tx: Transaction): TreasuryModule;
  reconciliationService: ReconciliationService;
  dealAttachmentIngestionWorkflow: DealAttachmentIngestionWorkflow;
  dealExecutionWorkflow: DealExecutionWorkflow;
  dealPricingWorkflow: DealPricingWorkflow;
  dealQuoteWorkflow: DealQuoteWorkflow;
  dealProjectionsWorkflow: DealProjectionsWorkflow;
  reconciliationAdjustmentsWorkflow: ReconciliationAdjustmentsWorkflow;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
  iamService: IamService;
  portalAccessGrantsService: PortalAccessGrantsService;
  ledgerModule: LedgerModule;
  documentsService: DocumentsService;
  documentDraftWorkflow: DocumentDraftWorkflow;
  documentPostingWorkflow: DocumentPostingWorkflow;
  customerPortalWorkflow: CustomerPortalWorkflow;
  documentGenerationWorkflow: DocumentGenerationWorkflow;
  documentsReadModel: DocumentsReadModel;
  partiesReadRuntime: ApiPartiesReadRuntime;
  documentExtraction?: DocumentExtractionPort;
  objectStorage?: S3ObjectStorageAdapter;
}

export function createAppContext(env: Env): AppContext {
  const core = createCoreServices();
  const applicationServices = createApplicationServices(core, env);

  return {
    env,
    logger: core.logger,
    idempotency: core.idempotency,
    persistence: core.persistence,
    accountingModule: core.accountingModule,
    agreementsModule: applicationServices.agreementsModule,
    calculationsModule: applicationServices.calculationsModule,
    dealsModule: applicationServices.dealsModule,
    filesModule: applicationServices.filesModule,
    ledgerModule: core.ledgerModule,
    partiesModule: applicationServices.partiesModule,
    currenciesService: applicationServices.currenciesService,
    treasuryModule: applicationServices.treasuryModule,
    createDealsModule: applicationServices.createDealsModule,
    createTreasuryModule: applicationServices.createTreasuryModule,
    reconciliationService: applicationServices.reconciliationService,
    dealAttachmentIngestionWorkflow:
      applicationServices.dealAttachmentIngestionWorkflow,
    dealExecutionWorkflow: applicationServices.dealExecutionWorkflow,
    dealPricingWorkflow: applicationServices.dealPricingWorkflow,
    dealQuoteWorkflow: applicationServices.dealQuoteWorkflow,
    dealProjectionsWorkflow: applicationServices.dealProjectionsWorkflow,
    reconciliationAdjustmentsWorkflow:
      applicationServices.reconciliationAdjustmentsWorkflow,
    organizationBootstrapWorkflow:
      applicationServices.organizationBootstrapWorkflow,
    requisiteAccountingWorkflow:
      applicationServices.requisiteAccountingWorkflow,
    iamService: core.iamService,
    portalAccessGrantsService: core.portalAccessGrantsService,
    documentsService: applicationServices.documentsService,
    documentDraftWorkflow: applicationServices.documentDraftWorkflow,
    documentPostingWorkflow: applicationServices.documentPostingWorkflow,
    customerPortalWorkflow: applicationServices.customerPortalWorkflow,
    documentGenerationWorkflow: applicationServices.documentGenerationWorkflow,
    documentsReadModel: applicationServices.documentsReadModel,
    partiesReadRuntime: applicationServices.partiesReadRuntime,
    documentExtraction: applicationServices.documentExtraction,
    objectStorage: applicationServices.objectStorage,
  };
}
