import type { AccountingModule } from "@bedrock/accounting";
import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import {
  createAccountingPeriodDocumentTransitionEffectsService,
  createDocumentsService,
  createRuleBasedDocumentActionPolicyService,
  type DocumentsService,
  type DocumentApprovalRule,
} from "@bedrock/documents";
import {
  createDrizzleDocumentsReadModel,
  type DocumentsReadModel,
} from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import { UserNotFoundError } from "@bedrock/iam";
import type { PartiesModule } from "@bedrock/parties";
import { OpenAIDocumentExtractionAdapter } from "@bedrock/platform/ai";
import { S3ObjectStorageAdapter } from "@bedrock/platform/object-storage";
import {
  bindPersistenceSession,
  createPersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import type { TreasuryModule } from "@bedrock/treasury";
import {
  createCustomerPortalWorkflow,
  type CustomerPortalWorkflow,
} from "@bedrock/workflow-customer-portal";
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
  createRequisiteAccountingWorkflow,
  type RequisiteAccountingWorkflow,
} from "@bedrock/workflow-requisite-accounting";

import { createApiAccountingModule } from "./accounting-module";
import { createApiAgreementsModule } from "./agreements-module";
import { createApiCalculationsModule } from "./calculations-module";
import type { ApiCoreServices } from "./core";
import { createApiDealsModule } from "./deals-module";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";
import { createApiFilesModule } from "./files-module";
import { createApiLedgerModule } from "./ledger-module";
import {
  createApiPartiesModule,
  createApiPartiesReadRuntime,
  type ApiPartiesReadRuntime,
} from "./parties-module";
import { createApiTreasuryModule } from "./treasury-module";
import type { Env } from "../context";
import { db } from "../db/client";

export interface ApiApplicationServices {
  agreementsModule: AgreementsModule;
  calculationsModule: CalculationsModule;
  dealsModule: DealsModule;
  filesModule: FilesModule;
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  treasuryModule: TreasuryModule;
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

const DEFAULT_DOCUMENT_APPROVAL_RULES: DocumentApprovalRule[] = [
  {
    docTypes: ["period_close", "period_reopen"],
    approvalMode: "maker_checker",
  },
  {
    docTypes: [
      "invoice",
      "exchange",
      "transfer_intra",
      "transfer_intercompany",
      "transfer_resolution",
      "fx_execute",
      "fx_resolution",
      "capital_funding",
    ],
    approvalMode: "maker_checker",
  },
];

export function createApplicationServices(
  platform: ApiCoreServices,
  env?: Env,
): ApiApplicationServices {
  const {
    accountingModule,
    customerMembershipsService,
    idempotency,
    iamService,
    ledgerModule,
    logger,
  } =
    platform;
  const ledgerReadPort = {
    getOperationDetails: ledgerModule.operations.queries.getDetails,
    listOperationDetails: ledgerModule.operations.queries.listDetails,
  };
  const createLedgerModuleForTransaction = (tx: Transaction) =>
    createApiLedgerModule({
      db: tx,
      idempotency,
      logger,
      persistence: bindPersistenceSession(tx),
    });

  const documentsReadModel = createDrizzleDocumentsReadModel({ db });
  const currenciesService = createCurrenciesService({ db, logger });
  const partiesReadRuntime = createApiPartiesReadRuntime(db);
  const currenciesPort = {
    async assertCurrencyExists(id: string) {
      await currenciesService.findById(id);
    },
    async listCodesById(ids: string[]) {
      const rows = await Promise.all(
        ids.map(
          async (id) =>
            [id, (await currenciesService.findById(id)).code] as const,
        ),
      );
      return new Map(rows);
    },
  };
  const treasuryCurrenciesPort = {
    findByCode: currenciesService.findByCode,
    findById: currenciesService.findById,
  };
  const treasuryModule = createApiTreasuryModule({
    db,
    persistence: createPersistenceContext(db),
    logger,
    currencies: treasuryCurrenciesPort,
  });
  const partiesModule = createApiPartiesModule({
    db,
    persistence: createPersistenceContext(db),
    documents: {
      hasDocumentsForCustomer(customerId) {
        return documentsReadModel.hasDocumentsForCustomer(customerId);
      },
    },
    currencies: currenciesPort,
    logger,
  });
  const agreementsModule = createApiAgreementsModule({
    db,
    logger,
    idempotency,
    currencies: currenciesService,
    persistence: createPersistenceContext(db),
  });
  const calculationsModule = createApiCalculationsModule({
    db,
    logger,
    idempotency,
    currencies: currenciesService,
    persistence: createPersistenceContext(db),
    treasuryQuotes: treasuryModule.quotes.queries,
  });
  const dealsModule = createApiDealsModule({
    currencies: currenciesService,
    db,
    logger,
    idempotency,
    persistence: createPersistenceContext(db),
  });
  const organizationBootstrapWorkflow = createOrganizationBootstrapWorkflow({
    db,
    createLedgerModule: createLedgerModuleForTransaction,
    logger,
  });
  const requisiteAccountingWorkflow = createRequisiteAccountingWorkflow({
    db,
    createLedgerModule: createLedgerModuleForTransaction,
    currencies: currenciesPort,
    logger,
  });
  const documentsAccountingPort = {
    getDefaultCompiledPack:
      accountingModule.packs.queries.getDefaultCompiledPack,
    loadActiveCompiledPackForBook:
      accountingModule.packs.queries.loadActivePackForBook,
    resolvePostingPlan: accountingModule.packs.queries.resolvePostingPlan,
  };
  const accountingPeriodsPort = {
    async assertOrganizationPeriodsOpen(input: {
      occurredAt: Date;
      organizationIds: string[];
      docType: string;
    }) {
      return accountingModule.periods.commands.assertOrganizationPeriodsOpen(input);
    },
    async listClosedOrganizationIdsForPeriod(input: {
      organizationIds: string[];
      occurredAt: Date;
    }) {
      return accountingModule.periods.queries.listClosedOrganizationIdsForPeriod(
        input,
      );
    },
    async closePeriod(input: {
      organizationId: string;
      periodStart: Date;
      periodEnd: Date;
      closedBy: string;
      closeReason?: string | null;
      closeDocumentId: string;
      db?: unknown;
    }) {
      const target = input.db as Transaction | undefined;
      const module: AccountingModule = target
        ? createApiAccountingModule({
            db: target,
            persistence: bindPersistenceSession(target),
            logger,
          })
        : accountingModule;

      return module.periods.commands.closePeriod({
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        closedBy: input.closedBy,
        closeReason: input.closeReason,
        closeDocumentId: input.closeDocumentId,
      });
    },
    async isOrganizationPeriodClosed(input: {
      organizationId: string;
      occurredAt: Date;
    }) {
      return accountingModule.periods.queries.isOrganizationPeriodClosed(input);
    },
    async reopenPeriod(input: {
      organizationId: string;
      periodStart: Date;
      reopenedBy: string;
      reopenReason?: string | null;
      reopenDocumentId?: string | null;
      db?: unknown;
    }) {
      const target = input.db as Transaction | undefined;
      const module: AccountingModule = target
        ? createApiAccountingModule({
            db: target,
            persistence: bindPersistenceSession(target),
            logger,
          })
        : accountingModule;

      return module.periods.commands.reopenPeriod({
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        reopenedBy: input.reopenedBy,
        reopenReason: input.reopenReason,
        reopenDocumentId: input.reopenDocumentId,
      });
    },
  };
  const documentRequisitesService = {
    findById: partiesModule.requisites.queries.findById,
    resolveBindings: partiesModule.requisites.queries.resolveBindings,
  };
  const documentPartiesService = {
    customers: {
      findById: partiesModule.customers.queries.findById,
    },
    counterparties: {
      findById: partiesModule.counterparties.queries.findById,
    },
  };
  const treasuryQuotes = {
    createQuote: treasuryModule.quotes.commands.createQuote,
    getQuoteDetails: treasuryModule.quotes.queries.getQuoteDetails,
    markQuoteUsed: async (
      input: Parameters<typeof treasuryModule.quotes.commands.markQuoteUsed>[0],
    ) => {
      let usedDocumentId = input.usedDocumentId ?? null;
      let dealId = input.dealId ?? null;

      if (!usedDocumentId) {
        const matched = input.usedByRef.match(
          /^(invoice|fx_execute):([0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-8][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12})$/,
        );
        if (matched) {
          usedDocumentId = matched[2]!;
        }
      }

      if (usedDocumentId) {
        const linkedDocument = await documentsReadModel.findBusinessLinkByDocumentId(
          usedDocumentId,
        );

        if (!linkedDocument) {
          throw new NotFoundError("Document", usedDocumentId);
        }

        if (
          dealId &&
          linkedDocument.dealId &&
          dealId !== linkedDocument.dealId
        ) {
          throw new ValidationError(
            `Quote document ${usedDocumentId} belongs to deal ${linkedDocument.dealId}, not ${dealId}`,
          );
        }

        dealId = dealId ?? linkedDocument.dealId ?? null;
      }

      return treasuryModule.quotes.commands.markQuoteUsed({
        ...input,
        dealId,
        usedDocumentId,
      });
    },
  };
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        currenciesService,
        treasuryQuotes,
        partiesService: documentPartiesService,
        requisitesService: documentRequisitesService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        currenciesService,
        treasuryQuotes,
        ledgerReadService: {
          getOperationDetails: ledgerModule.operations.queries.getDetails,
        },
        requisitesService: documentRequisitesService,
      }),
    ),
  ]);
  const documentsPolicy = createRuleBasedDocumentActionPolicyService({
    rules: DEFAULT_DOCUMENT_APPROVAL_RULES,
    async isActorExemptFromApproval({ actorUserId }) {
      try {
        return (await iamService.queries.findById(actorUserId)).role === "admin";
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return false;
        }

        throw error;
      }
    },
  });
  const documentTransitionEffects =
    createAccountingPeriodDocumentTransitionEffectsService();
  const documentsCoreService = createDocumentsService({
    persistence: createPersistenceContext(db),
    idempotency,
    accounting: documentsAccountingPort,
    accountingPeriods: accountingPeriodsPort,
    ledgerReadService: ledgerReadPort,
    policy: documentsPolicy,
    registry: documentRegistry,
    transitionEffects: documentTransitionEffects,
    logger,
  });

  function createDocumentsServiceForTransaction(tx: Transaction) {
    return createDocumentsService({
      persistence: bindPersistenceSession(tx),
      idempotency,
      accounting: documentsAccountingPort,
      accountingPeriods: accountingPeriodsPort,
      ledgerReadService: ledgerReadPort,
      policy: documentsPolicy,
      registry: documentRegistry,
      transitionEffects: documentTransitionEffects,
      logger,
    });
  }
  const documentsService = documentsCoreService;
  const documentDraftWorkflow = createDocumentDraftWorkflow({
    db,
    createDocumentsService: createDocumentsServiceForTransaction,
  });
  const documentPostingWorkflow = createDocumentPostingWorkflow({
    db,
    idempotency,
    createLedgerModule: createLedgerModuleForTransaction,
    createDocumentsService: createDocumentsServiceForTransaction,
  });

  const objectStorage = env?.S3_ENDPOINT && env?.S3_ACCESS_KEY && env?.S3_SECRET_KEY
    ? new S3ObjectStorageAdapter({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION ?? "us-east-1",
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
        bucket: env.S3_BUCKET ?? "bedrock-documents",
        forcePathStyle: true,
      }, logger)
    : undefined;
  const filesModule = createApiFilesModule({
    db,
    logger,
    objectStorage,
    persistence: createPersistenceContext(db),
  });

  // Customer portal workflow
  const customerPortalWorkflow = createCustomerPortalWorkflow({
    calculations: calculationsModule,
    currencies: currenciesService,
    deals: dealsModule,
    iam: {
      customerMemberships: customerMembershipsService,
      users: iamService,
    },
    parties: {
      counterparties: partiesModule.counterparties,
      customers: partiesModule.customers,
    },
    logger,
  });

  // Document generation workflow
  const templatesDir = new URL(
    "../../../../packages/workflows/document-generation/templates",
    import.meta.url,
  ).pathname;

  const templateAdapter = createEasyTemplateXAdapter({
    templatesDir,
    logger,
  });

  const documentGenerationWorkflow = createDocumentGenerationWorkflow({
    templateRenderer: templateAdapter,
    pdfConverter: createLibreOfficeConvertAdapter(),
    templateManager: templateAdapter,
    objectStorage,
    logger,
  });

  // AI document extraction (optional)
  const documentExtraction = env?.OPENAI_API_KEY
    ? new OpenAIDocumentExtractionAdapter({ apiKey: env.OPENAI_API_KEY })
    : undefined;

  return {
    agreementsModule,
    calculationsModule,
    dealsModule,
    filesModule,
    partiesModule,
    currenciesService,
    treasuryModule,
    organizationBootstrapWorkflow,
    requisiteAccountingWorkflow,
    documentsService,
    documentDraftWorkflow,
    documentPostingWorkflow,
    customerPortalWorkflow,
    documentGenerationWorkflow,
    documentsReadModel,
    partiesReadRuntime,
    documentExtraction,
    objectStorage,
  };
}
