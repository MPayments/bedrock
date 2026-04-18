import { DrizzleDealStore } from "@bedrock/deals/adapters/drizzle";
import { OpenAIDocumentExtractionAdapter } from "@bedrock/platform/ai";
import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import type { Logger } from "@bedrock/platform/observability/logger";
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
  createDocumentPostingWorkflow,
  type DocumentPostingWorkflow,
} from "@bedrock/workflow-document-posting";
import {
  createReconciliationAdjustmentsWorkflow,
  type ReconciliationAdjustmentsWorkflow,
} from "@bedrock/workflow-reconciliation-adjustments";

import type { ApiCoreServices } from "./core";
import type { ApplicationDocuments } from "./documents";
import type { ApplicationModules } from "./modules";
import type { ApplicationTransactions } from "./transactions";
import type { Env } from "../context";
import { db } from "../db/client";

export interface ApplicationWorkflows {
  dealAttachmentIngestionWorkflow: DealAttachmentIngestionWorkflow;
  dealExecutionWorkflow: DealExecutionWorkflow;
  dealProjectionsWorkflow: DealProjectionsWorkflow;
  documentExtraction?: OpenAIDocumentExtractionAdapter;
  documentPostingWorkflow: DocumentPostingWorkflow;
  reconciliationAdjustmentsWorkflow: ReconciliationAdjustmentsWorkflow;
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
  const { iamService, idempotency, logger } = platform;

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

  const documentExtraction = createDocumentExtractionAdapter(env);
  const dealAttachmentIngestionWorkflow = createDealAttachmentIngestionWorkflow({
    currencies: modules.currenciesService,
    deals: modules.dealsModule,
    documentExtraction,
    files: modules.filesModule,
    logger,
  });

  return {
    dealAttachmentIngestionWorkflow,
    dealExecutionWorkflow,
    dealProjectionsWorkflow,
    documentExtraction,
    documentPostingWorkflow,
    reconciliationAdjustmentsWorkflow,
  };
}
