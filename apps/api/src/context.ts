import { z } from "zod";

import type { AccountingModule } from "@bedrock/accounting";
import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type {
  DocumentGenerationService,
  DocumentsService,
} from "@bedrock/documents";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import type {
  CustomerMembershipsService,
  IamService,
  PortalAccessGrantsService,
} from "@bedrock/iam";
import type { LedgerModule } from "@bedrock/ledger";
import type { PartiesModule } from "@bedrock/parties";
import type { PartiesQueries } from "@bedrock/parties/queries";
import type { DocumentExtractionPort } from "@bedrock/platform/ai";
import type { IdempotencyService } from "@bedrock/platform/idempotency-postgres";
import type { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { PersistenceContext } from "@bedrock/platform/persistence";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";
import type { PortalService } from "@bedrock/use-case-portal";
import type { DealQuoteService } from "@bedrock/use-case-deal-quote";
import type { OrganizationBootstrapService } from "@bedrock/use-case-organization-bootstrap";
import type { RequisiteAccountingService } from "@bedrock/use-case-requisite-accounting";
import type { DealAttachmentIngestionWorkflow } from "@bedrock/workflow-deal-attachment-ingestion";
import type { DealExecutionWorkflow } from "@bedrock/workflow-deal-execution";
import type { DealProjectionsWorkflow } from "@bedrock/workflow-deal-projections";
import type { DocumentPostingWorkflow } from "@bedrock/workflow-document-posting";
import type { ReconciliationAdjustmentsWorkflow } from "@bedrock/workflow-reconciliation-adjustments";

import { createApplicationServices } from "./composition/application";
import type { ApiPartiesReadRuntime } from "./composition/application";
import { createCoreServices } from "./composition/core";

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
  BETTER_AUTH_CRM_TRUSTED_ORIGINS: z.string().optional(),
  BETTER_AUTH_FINANCE_TRUSTED_ORIGINS: z.string().optional(),
  BETTER_AUTH_PORTAL_TRUSTED_ORIGINS: z.string().optional(),

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
  reconciliationService: ReconciliationService;
  customerMembershipsService: CustomerMembershipsService;
  dealQuoteService: DealQuoteService;
  dealAttachmentIngestionWorkflow: DealAttachmentIngestionWorkflow;
  dealExecutionWorkflow: DealExecutionWorkflow;
  dealProjectionsWorkflow: DealProjectionsWorkflow;
  reconciliationAdjustmentsWorkflow: ReconciliationAdjustmentsWorkflow;
  organizationBootstrapService: OrganizationBootstrapService;
  portalService: PortalService;
  requisiteAccountingService: RequisiteAccountingService;
  iamService: IamService;
  portalAccessGrantsService: PortalAccessGrantsService;
  ledgerModule: LedgerModule;
  documentsService: DocumentsService;
  documentPostingWorkflow: DocumentPostingWorkflow;
  documentGenerationService: DocumentGenerationService;
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
    reconciliationService: applicationServices.reconciliationService,
    customerMembershipsService: core.customerMembershipsService,
    dealQuoteService: applicationServices.dealQuoteService,
    dealAttachmentIngestionWorkflow:
      applicationServices.dealAttachmentIngestionWorkflow,
    dealExecutionWorkflow: applicationServices.dealExecutionWorkflow,
    dealProjectionsWorkflow: applicationServices.dealProjectionsWorkflow,
    reconciliationAdjustmentsWorkflow:
      applicationServices.reconciliationAdjustmentsWorkflow,
    organizationBootstrapService:
      applicationServices.organizationBootstrapService,
    portalService: applicationServices.portalService,
    requisiteAccountingService:
      applicationServices.requisiteAccountingService,
    iamService: core.iamService,
    portalAccessGrantsService: core.portalAccessGrantsService,
    documentsService: applicationServices.documentsService,
    documentPostingWorkflow: applicationServices.documentPostingWorkflow,
    documentGenerationService: applicationServices.documentGenerationService,
    documentsReadModel: applicationServices.documentsReadModel,
    partiesReadRuntime: applicationServices.partiesReadRuntime,
    documentExtraction: applicationServices.documentExtraction,
    objectStorage: applicationServices.objectStorage,
  };
}
