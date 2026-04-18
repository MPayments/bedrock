import { OpenAIDocumentExtractionAdapter } from "@bedrock/platform/ai";
import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import type { Logger } from "@bedrock/platform/observability/logger";
import { DrizzleDealStore } from "@bedrock/deals/adapters/drizzle";
import {
  createCustomerPortalWorkflow,
  type CustomerPortalWorkflow,
} from "@bedrock/workflow-customer-portal";
import {
  createDealAttachmentIngestionWorkflow,
  type DealAttachmentIngestionWorkflow,
} from "@bedrock/workflow-deal-attachment-ingestion";
import {
  createDealExecutionWorkflow,
  type DealExecutionWorkflow,
} from "@bedrock/workflow-deal-execution";
import {
  createDealProjectionsWorkflow,
  type DealProjectionsWorkflow,
} from "@bedrock/workflow-deal-projections";
import {
  createDocumentDraftWorkflow,
  type DocumentDraftWorkflow,
} from "@bedrock/workflow-document-drafts";
import {
  createDocumentGenerationWorkflow,
  createEasyTemplateXAdapter,
  createLibreOfficeConvertAdapter,
  type DocumentGenerationWorkflow,
} from "@bedrock/workflow-document-generation";
import {
  createDocumentPostingWorkflow,
  type DocumentPostingWorkflow,
} from "@bedrock/workflow-document-posting";
import {
  createOrganizationBootstrapWorkflow,
  type OrganizationBootstrapWorkflow,
} from "@bedrock/workflow-organization-bootstrap";
import {
  createReconciliationAdjustmentsWorkflow,
  type ReconciliationAdjustmentsWorkflow,
} from "@bedrock/workflow-reconciliation-adjustments";
import {
  createRequisiteAccountingWorkflow,
  type RequisiteAccountingWorkflow,
} from "@bedrock/workflow-requisite-accounting";

import type { Env } from "../context";
import { db } from "../db/client";
import type { ApiCoreServices } from "./core";
import {
  createDealQuoteWorkflow,
  type DealQuoteWorkflow,
} from "./deal-quote-workflow";
import type { ApplicationDocuments } from "./documents";
import type { ApplicationModules } from "./modules";
import type { ApplicationTransactions } from "./transactions";

export interface ApplicationWorkflows {
  customerPortalWorkflow: CustomerPortalWorkflow;
  dealAttachmentIngestionWorkflow: DealAttachmentIngestionWorkflow;
  dealExecutionWorkflow: DealExecutionWorkflow;
  dealProjectionsWorkflow: DealProjectionsWorkflow;
  dealQuoteWorkflow: DealQuoteWorkflow;
  documentDraftWorkflow: DocumentDraftWorkflow;
  documentExtraction?: OpenAIDocumentExtractionAdapter;
  documentGenerationWorkflow: DocumentGenerationWorkflow;
  documentPostingWorkflow: DocumentPostingWorkflow;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  reconciliationAdjustmentsWorkflow: ReconciliationAdjustmentsWorkflow;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
}

export function createObjectStorageAdapter(
  env: Env | undefined,
  logger: Logger,
) {
  return env?.S3_ENDPOINT && env?.S3_ACCESS_KEY && env?.S3_SECRET_KEY
    ? new S3ObjectStorageAdapter(
        {
          endpoint: env.S3_ENDPOINT,
          publicEndpoint: env.S3_PUBLIC_ENDPOINT,
          region: env.S3_REGION ?? "us-east-1",
          accessKeyId: env.S3_ACCESS_KEY,
          secretAccessKey: env.S3_SECRET_KEY,
          bucket: env.S3_BUCKET ?? "bedrock-documents",
          forcePathStyle: true,
        },
        logger,
      )
    : undefined;
}

export function createDocumentExtractionAdapter(env?: Env) {
  return env?.OPENAI_API_KEY
    ? new OpenAIDocumentExtractionAdapter({ apiKey: env.OPENAI_API_KEY })
    : undefined;
}

export function createApplicationWorkflows(input: {
  documents: ApplicationDocuments;
  env?: Env;
  modules: ApplicationModules;
  platform: ApiCoreServices;
  transactions: ApplicationTransactions;
}): ApplicationWorkflows {
  const { documents, env, modules, platform, transactions } = input;
  const { customerMembershipsService, iamService, idempotency, logger, portalAccessGrantsService } =
    platform;

  const dealQuoteWorkflow = createDealQuoteWorkflow({
    agreements: modules.agreementsModule,
    calculations: modules.calculationsModule,
    currencies: modules.currenciesService,
    deals: modules.dealsModule,
    treasury: modules.treasuryModule,
  });
  const dealExecutionWorkflow = createDealExecutionWorkflow({
    agreements: modules.agreementsModule,
    currencies: modules.currenciesService,
    db,
    idempotency,
    createDealStore: (tx) => new DrizzleDealStore(tx),
    createDealsModule: transactions.createDealsModuleForTransaction,
    createReconciliationService:
      transactions.createReconciliationServiceForTransaction,
    createTreasuryModule: transactions.createTreasuryModuleForTransaction,
  });
  const organizationBootstrapWorkflow = createOrganizationBootstrapWorkflow({
    db,
    createLedgerModule: transactions.createLedgerModuleForTransaction,
    logger,
  });
  const requisiteAccountingWorkflow = createRequisiteAccountingWorkflow({
    db,
    createLedgerModule: transactions.createLedgerModuleForTransaction,
    currencies: modules.currenciesPort,
    logger,
  });
  const documentDraftWorkflow = createDocumentDraftWorkflow({
    db,
    createDocumentsService: documents.createDocumentsServiceForTransaction,
  });
  const documentPostingWorkflow = createDocumentPostingWorkflow({
    db,
    idempotency,
    createLedgerModule: transactions.createLedgerModuleForTransaction,
    createDocumentsService: documents.createDocumentsServiceForTransaction,
  });
  const reconciliationAdjustmentsWorkflow =
    createReconciliationAdjustmentsWorkflow({
      db,
      idempotency,
      createDocumentsService: documents.createDocumentsServiceForTransaction,
      createReconciliationService:
        transactions.createReconciliationServiceForTransaction,
    });
  const dealProjectionsWorkflow = createDealProjectionsWorkflow({
    agreements: modules.agreementsModule,
    calculations: modules.calculationsModule,
    currencies: modules.currenciesService,
    deals: modules.dealsModule,
    documentsReadModel: modules.documentsReadModel,
    files: modules.filesModule,
    iam: iamService,
    parties: modules.partiesModule,
    reconciliation: modules.reconciliationService,
    treasury: modules.treasuryModule,
  });
  const customerPortalWorkflow = createCustomerPortalWorkflow({
    calculations: modules.calculationsModule,
    currencies: modules.currenciesService,
    deals: modules.dealsModule,
    iam: {
      customerMemberships: customerMembershipsService,
      portalAccessGrants: portalAccessGrantsService,
      users: iamService,
    },
    parties: {
      counterparties: modules.partiesModule.counterparties,
      customers: modules.partiesModule.customers,
      requisites: modules.partiesModule.requisites,
    },
    logger,
  });

  const templatesDir = new URL(
    "../../../../packages/workflows/document-generation/templates",
    import.meta.url,
  ).pathname;
  const templateAdapter = createEasyTemplateXAdapter({
    templatesDir,
    logger,
  });
  const documentGenerationWorkflow = createDocumentGenerationWorkflow({
    agreements: modules.agreementsModule,
    currencies: modules.currenciesService,
    parties: modules.partiesModule,
    templateRenderer: templateAdapter,
    pdfConverter: createLibreOfficeConvertAdapter(),
    templateManager: templateAdapter,
    objectStorage: modules.objectStorage,
    logger,
  });

  const documentExtraction = createDocumentExtractionAdapter(env);
  const dealAttachmentIngestionWorkflow = createDealAttachmentIngestionWorkflow({
    currencies: modules.currenciesService,
    deals: modules.dealsModule,
    documentExtraction,
    files: modules.filesModule,
    logger,
  });

  return {
    customerPortalWorkflow,
    dealAttachmentIngestionWorkflow,
    dealExecutionWorkflow,
    dealProjectionsWorkflow,
    dealQuoteWorkflow,
    documentDraftWorkflow,
    documentExtraction,
    documentGenerationWorkflow,
    documentPostingWorkflow,
    organizationBootstrapWorkflow,
    reconciliationAdjustmentsWorkflow,
    requisiteAccountingWorkflow,
  };
}
