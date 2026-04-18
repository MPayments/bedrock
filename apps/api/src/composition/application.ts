import type { AccountingModule } from "@bedrock/accounting";
import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type { DocumentsService } from "@bedrock/documents";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import type { PartiesModule } from "@bedrock/parties";
import { OpenAIDocumentExtractionAdapter } from "@bedrock/platform/ai";
import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  type CustomerPortalWorkflow,
} from "@bedrock/workflow-customer-portal";
import {
  type DealAttachmentIngestionWorkflow,
} from "@bedrock/workflow-deal-attachment-ingestion";
import {
  type DealExecutionWorkflow,
} from "@bedrock/workflow-deal-execution";
import {
  type DealProjectionsWorkflow,
} from "@bedrock/workflow-deal-projections";
import {
  type DocumentDraftWorkflow,
} from "@bedrock/workflow-document-drafts";
import {
  type DocumentGenerationWorkflow,
} from "@bedrock/workflow-document-generation";
import {
  type DocumentPostingWorkflow,
} from "@bedrock/workflow-document-posting";
import {
  type OrganizationBootstrapWorkflow,
} from "@bedrock/workflow-organization-bootstrap";
import {
  type ReconciliationAdjustmentsWorkflow,
} from "@bedrock/workflow-reconciliation-adjustments";
import {
  type RequisiteAccountingWorkflow,
} from "@bedrock/workflow-requisite-accounting";

import type { ApiCoreServices } from "./core";
import { createApplicationDocuments } from "./documents";
import {
  type DealQuoteWorkflow,
} from "./deal-quote-workflow";
import {
  createApplicationModules,
  type ApplicationPartiesReadRuntime,
} from "./modules";
import { createApplicationTransactions } from "./transactions";
import { createApplicationWorkflows } from "./workflows";
import type { Env } from "../context";

export interface ApiApplicationServices {
  agreementsModule: AgreementsModule;
  calculationsModule: CalculationsModule;
  dealsModule: DealsModule;
  reconciliationService: ReconciliationService;
  filesModule: FilesModule;
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  treasuryModule: TreasuryModule;
  dealAttachmentIngestionWorkflow: DealAttachmentIngestionWorkflow;
  dealExecutionWorkflow: DealExecutionWorkflow;
  dealQuoteWorkflow: DealQuoteWorkflow;
  dealProjectionsWorkflow: DealProjectionsWorkflow;
  reconciliationAdjustmentsWorkflow: ReconciliationAdjustmentsWorkflow;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
  documentsService: DocumentsService;
  documentDraftWorkflow: DocumentDraftWorkflow;
  documentPostingWorkflow: DocumentPostingWorkflow;
  customerPortalWorkflow: CustomerPortalWorkflow;
  documentGenerationWorkflow: DocumentGenerationWorkflow;
  documentsReadModel: DocumentsReadModel;
  partiesReadRuntime: ApiPartiesReadRuntime;
  documentExtraction?: OpenAIDocumentExtractionAdapter;
  objectStorage?: S3ObjectStorageAdapter;
}

export interface ApiPartiesReadRuntime extends ApplicationPartiesReadRuntime {}

export function createApplicationServices(
  platform: ApiCoreServices,
  env?: Env,
): ApiApplicationServices {
  const modules = createApplicationModules({ env, platform });
  const transactions = createApplicationTransactions({ modules, platform });
  let dealQuoteWorkflow: DealQuoteWorkflow | undefined;

  const documents = createApplicationDocuments({
    // Documents depend on quote actions, while later workflows depend on documents.
    getDealQuoteWorkflow() {
      if (!dealQuoteWorkflow) {
        throw new Error("Deal quote workflow is not initialized");
      }

      return dealQuoteWorkflow;
    },
    modules,
    platform,
    transactions,
  });
  const workflows = createApplicationWorkflows({
    documents,
    env,
    modules,
    platform,
    transactions,
  });
  dealQuoteWorkflow = workflows.dealQuoteWorkflow;

  return {
    agreementsModule: modules.agreementsModule,
    calculationsModule: modules.calculationsModule,
    dealsModule: modules.dealsModule,
    reconciliationService: modules.reconciliationService,
    filesModule: modules.filesModule,
    partiesModule: modules.partiesModule,
    currenciesService: modules.currenciesService,
    treasuryModule: modules.treasuryModule,
    dealAttachmentIngestionWorkflow:
      workflows.dealAttachmentIngestionWorkflow,
    dealExecutionWorkflow: workflows.dealExecutionWorkflow,
    dealQuoteWorkflow: workflows.dealQuoteWorkflow,
    dealProjectionsWorkflow: workflows.dealProjectionsWorkflow,
    reconciliationAdjustmentsWorkflow:
      workflows.reconciliationAdjustmentsWorkflow,
    organizationBootstrapWorkflow:
      workflows.organizationBootstrapWorkflow,
    requisiteAccountingWorkflow:
      workflows.requisiteAccountingWorkflow,
    documentsService: documents.documentsService,
    documentDraftWorkflow: workflows.documentDraftWorkflow,
    documentPostingWorkflow: workflows.documentPostingWorkflow,
    customerPortalWorkflow: workflows.customerPortalWorkflow,
    documentGenerationWorkflow: workflows.documentGenerationWorkflow,
    documentsReadModel: modules.documentsReadModel,
    partiesReadRuntime: modules.partiesReadRuntime,
    documentExtraction: workflows.documentExtraction,
    objectStorage: modules.objectStorage,
  };
}
