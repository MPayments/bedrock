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
import type { PartiesModule } from "@bedrock/parties";
import type { OpenAIDocumentExtractionAdapter } from "@bedrock/platform/ai";
import type { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { TreasuryModule } from "@bedrock/treasury";
import type { DealQuoteService } from "@bedrock/use-case-deal-quote";
import type { OrganizationBootstrapService } from "@bedrock/use-case-organization-bootstrap";
import type { PortalService } from "@bedrock/use-case-portal";
import type { RequisiteAccountingService } from "@bedrock/use-case-requisite-accounting";
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
  type DocumentPostingWorkflow,
} from "@bedrock/workflow-document-posting";
import {
  type ReconciliationAdjustmentsWorkflow,
} from "@bedrock/workflow-reconciliation-adjustments";

import type { ApiCoreServices } from "./core";
import { createApplicationDocuments } from "./documents";
import {
  createApplicationModules,
  type ApplicationPartiesReadRuntime,
} from "./modules";
import { createApplicationOwnedServices } from "./services";
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
  dealQuoteService: DealQuoteService;
  dealAttachmentIngestionWorkflow: DealAttachmentIngestionWorkflow;
  dealExecutionWorkflow: DealExecutionWorkflow;
  dealProjectionsWorkflow: DealProjectionsWorkflow;
  reconciliationAdjustmentsWorkflow: ReconciliationAdjustmentsWorkflow;
  organizationBootstrapService: OrganizationBootstrapService;
  portalService: PortalService;
  requisiteAccountingService: RequisiteAccountingService;
  documentsService: DocumentsService;
  documentPostingWorkflow: DocumentPostingWorkflow;
  documentGenerationService: DocumentGenerationService;
  documentsReadModel: DocumentsReadModel;
  partiesReadRuntime: ApiPartiesReadRuntime;
  documentExtraction?: OpenAIDocumentExtractionAdapter;
  objectStorage?: S3ObjectStorageAdapter;
}

export type ApiPartiesReadRuntime = ApplicationPartiesReadRuntime;

export function createApplicationServices(
  platform: ApiCoreServices,
  env?: Env,
): ApiApplicationServices {
  const modules = createApplicationModules({ env, platform });
  const transactions = createApplicationTransactions({ modules, platform });
  const services = createApplicationOwnedServices({
    modules,
    platform,
    transactions,
  });

  const documents = createApplicationDocuments({
    dealQuoteService: services.dealQuoteService,
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

  return {
    agreementsModule: modules.agreementsModule,
    calculationsModule: modules.calculationsModule,
    dealsModule: modules.dealsModule,
    reconciliationService: modules.reconciliationService,
    filesModule: modules.filesModule,
    partiesModule: modules.partiesModule,
    currenciesService: modules.currenciesService,
    treasuryModule: modules.treasuryModule,
    dealQuoteService: services.dealQuoteService,
    dealAttachmentIngestionWorkflow:
      workflows.dealAttachmentIngestionWorkflow,
    dealExecutionWorkflow: workflows.dealExecutionWorkflow,
    dealProjectionsWorkflow: workflows.dealProjectionsWorkflow,
    reconciliationAdjustmentsWorkflow:
      workflows.reconciliationAdjustmentsWorkflow,
    organizationBootstrapService:
      services.organizationBootstrapService,
    portalService: services.portalService,
    requisiteAccountingService:
      services.requisiteAccountingService,
    documentsService: documents.documentsService,
    documentPostingWorkflow: workflows.documentPostingWorkflow,
    documentGenerationService: services.documentGenerationService,
    documentsReadModel: modules.documentsReadModel,
    partiesReadRuntime: modules.partiesReadRuntime,
    documentExtraction: workflows.documentExtraction,
    objectStorage: modules.objectStorage,
  };
}
