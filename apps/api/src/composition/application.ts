import type { AccountingModule } from "@bedrock/accounting";
import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import { DrizzleDealStore } from "@bedrock/deals/adapters/drizzle";
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
import {
  createReconciliationService,
  type ReconciliationService,
} from "@bedrock/reconciliation";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import type { TreasuryModule } from "@bedrock/treasury";
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
  reconciliationService: ReconciliationService;
  filesModule: FilesModule;
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  treasuryModule: TreasuryModule;
  dealAttachmentIngestionWorkflow: DealAttachmentIngestionWorkflow;
  dealExecutionWorkflow: DealExecutionWorkflow;
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

type ReconciliationExecutionFillBridgeInput = {
  actualRateDen: bigint | null;
  actualRateNum: bigint | null;
  boughtAmountMinor: bigint | null;
  boughtCurrencyId: string | null;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  executedAt: Date | null;
  externalRecordId: string | null;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  soldAmountMinor: bigint | null;
  soldCurrencyId: string | null;
  sourceRef: string;
};

type ReconciliationExecutionFeeBridgeInput = {
  amountMinor: bigint | null;
  calculationSnapshotId: string | null;
  chargedAt: Date | null;
  componentCode: string | null;
  confirmedAt: Date | null;
  currencyId: string | null;
  externalRecordId: string | null;
  feeFamily: string;
  fillId: string | null;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeComponentId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceRef: string;
};

type ReconciliationCashMovementBridgeInput = {
  accountRef: string | null;
  amountMinor: bigint | null;
  bookedAt: Date | null;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  currencyId: string | null;
  direction: "credit" | "debit";
  externalRecordId: string | null;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  requisiteId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceRef: string;
  statementRef: string | null;
  valueDate: Date | null;
};

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
    portalAccessGrantsService,
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
  const createTreasuryModuleForTransaction = (tx: Transaction) =>
    createApiTreasuryModule({
      db: tx,
      logger,
      currencies: treasuryCurrenciesPort,
      persistence: bindPersistenceSession(tx),
    });
  const createDealsModuleForTransaction = (tx: Transaction) =>
    createApiDealsModule({
      currencies: currenciesService,
      db: tx,
      ledgerBalances: createLedgerModuleForTransaction(tx).balances.queries,
      quoteReads: createTreasuryModuleForTransaction(tx).quotes.queries,
      logger,
      idempotency,
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
  const dealsModule = createApiDealsModule({
    currencies: currenciesService,
    db,
    ledgerBalances: ledgerModule.balances.queries,
    quoteReads: treasuryModule.quotes.queries,
    logger,
    idempotency,
    persistence: createPersistenceContext(db),
  });
  const agreementsModule = createApiAgreementsModule({
    db,
    logger,
    idempotency,
    currencies: currenciesService,
    persistence: createPersistenceContext(db),
    routeTemplates: {
      async findById(id: string) {
        try {
          const template = await dealsModule.deals.queries.findRouteTemplateById(
            id,
          );

          return {
            id: template.id,
            dealType: template.dealType,
            status: template.status,
          };
        } catch {
          return null;
        }
      },
    },
  });
  const calculationsModule = createApiCalculationsModule({
    db,
    logger,
    idempotency,
    currencies: currenciesService,
    persistence: createPersistenceContext(db),
    treasuryQuotes: treasuryModule.quotes.queries,
  });
  const createReconciliationExecutionFacts = (tx: Transaction) => {
    const treasuryTxModule = createTreasuryModuleForTransaction(tx);

    return {
      async recordExecutionFill(input: ReconciliationExecutionFillBridgeInput) {
        const existingFills =
          await treasuryTxModule.operations.queries.listExecutionFills({
            limit: 100,
            offset: 0,
            operationId: input.operationId,
            sortBy: "executedAt",
            sortOrder: "desc",
          });

        const duplicate = existingFills.data.some(
          (fill) =>
            fill.sourceRef === input.sourceRef ||
            (input.externalRecordId !== null &&
              fill.externalRecordId === input.externalRecordId) ||
            (input.instructionId !== null &&
              fill.instructionId === input.instructionId),
        );

        if (duplicate) {
          return;
        }

        const operation = await treasuryTxModule.operations.queries.findById(
          input.operationId,
        );

        if (!operation) {
          return;
        }

        await treasuryTxModule.operations.commands.recordExecutionFill({
          actualRateDen: input.actualRateDen,
          actualRateNum: input.actualRateNum,
          boughtAmountMinor: input.boughtAmountMinor,
          boughtCurrencyId:
            input.boughtCurrencyId ?? operation.counterCurrencyId,
          calculationSnapshotId: input.calculationSnapshotId,
          confirmedAt: input.confirmedAt,
          executedAt: input.executedAt,
          externalRecordId: input.externalRecordId,
          fillSequence: null,
          instructionId: input.instructionId,
          metadata: input.metadata,
          notes: input.notes,
          operationId: input.operationId,
          providerCounterpartyId: input.providerCounterpartyId,
          providerRef: input.providerRef,
          routeLegId: input.routeLegId ?? operation.routeLegId,
          routeVersionId: input.routeVersionId,
          soldAmountMinor: input.soldAmountMinor,
          soldCurrencyId: input.soldCurrencyId ?? operation.currencyId,
          sourceKind: "reconciliation",
          sourceRef: input.sourceRef,
        });
      },

      async recordExecutionFee(input: ReconciliationExecutionFeeBridgeInput) {
        const existingFees =
          await treasuryTxModule.operations.queries.listExecutionFees({
            limit: 100,
            offset: 0,
            operationId: input.operationId,
            sortBy: "chargedAt",
            sortOrder: "desc",
          });

        const duplicate = existingFees.data.some(
          (fee) =>
            fee.sourceRef === input.sourceRef ||
            (input.externalRecordId !== null &&
              fee.externalRecordId === input.externalRecordId) ||
            (input.instructionId !== null &&
              fee.instructionId === input.instructionId),
        );

        if (duplicate) {
          return;
        }

        const operation = await treasuryTxModule.operations.queries.findById(
          input.operationId,
        );

        if (!operation) {
          return;
        }

        await treasuryTxModule.operations.commands.recordExecutionFee({
          amountMinor: input.amountMinor,
          calculationSnapshotId: input.calculationSnapshotId,
          chargedAt: input.chargedAt,
          componentCode: input.componentCode,
          confirmedAt: input.confirmedAt,
          currencyId: input.currencyId ?? operation.currencyId,
          externalRecordId: input.externalRecordId,
          feeFamily: input.feeFamily,
          fillId: input.fillId,
          instructionId: input.instructionId,
          metadata: input.metadata,
          notes: input.notes,
          operationId: input.operationId,
          providerCounterpartyId: input.providerCounterpartyId,
          providerRef: input.providerRef,
          routeComponentId: input.routeComponentId,
          routeLegId: input.routeLegId ?? operation.routeLegId,
          routeVersionId: input.routeVersionId,
          sourceKind: "reconciliation",
          sourceRef: input.sourceRef,
        });
      },

      async recordCashMovement(input: ReconciliationCashMovementBridgeInput) {
        const existingMovements =
          await treasuryTxModule.operations.queries.listCashMovements({
          limit: 100,
          offset: 0,
          operationId: input.operationId,
          sortBy: "bookedAt",
          sortOrder: "desc",
        });

        const duplicate = existingMovements.data.some(
          (movement) =>
            movement.sourceRef === input.sourceRef ||
            (input.externalRecordId !== null &&
              movement.externalRecordId === input.externalRecordId) ||
            (input.instructionId !== null &&
              movement.instructionId === input.instructionId),
        );

        if (duplicate) {
          return;
        }

        const operation = await treasuryTxModule.operations.queries.findById(
          input.operationId,
        );

        if (!operation) {
          return;
        }

        await treasuryTxModule.operations.commands.recordCashMovement({
          accountRef: input.accountRef,
          amountMinor: input.amountMinor,
          bookedAt: input.bookedAt,
          calculationSnapshotId: input.calculationSnapshotId,
          confirmedAt: input.confirmedAt,
          currencyId: input.currencyId ?? operation.currencyId,
          direction: input.direction,
          externalRecordId: input.externalRecordId,
          instructionId: input.instructionId,
          metadata: input.metadata,
          notes: input.notes,
          operationId: input.operationId,
          providerCounterpartyId: input.providerCounterpartyId,
          providerRef: input.providerRef,
          requisiteId: input.requisiteId,
          routeLegId: input.routeLegId ?? operation.routeLegId,
          routeVersionId: input.routeVersionId,
          sourceKind: "reconciliation",
          sourceRef: input.sourceRef,
          statementRef: input.statementRef,
          valueDate: input.valueDate,
        });
      },
    };
  };
  const createReconciliationServiceForTransaction = (tx: Transaction) =>
    createReconciliationService({
      createExecutionFacts: createReconciliationExecutionFacts,
      persistence: bindPersistenceSession(tx),
      idempotency,
      documents: {
        async existsById(documentId: string) {
          return createDrizzleDocumentsReadModel({ db: tx }).existsById(
            documentId,
          );
        },
      },
      ledgerLookup: {
        async operationExists(operationId: string) {
          return (
            (await createLedgerModuleForTransaction(tx).operations.queries.getDetails(
              operationId,
            )) !== null
          );
        },
        async treasuryOperationExists(operationId: string) {
          return (
            (await createTreasuryModuleForTransaction(tx).operations.queries.findById(
              operationId,
            )) !== null
          );
        },
      },
      logger,
    });
  const reconciliationService = createReconciliationService({
    createExecutionFacts: createReconciliationExecutionFacts,
    persistence: createPersistenceContext(db),
    idempotency,
    documents: {
      existsById(documentId: string) {
        return documentsReadModel.existsById(documentId);
      },
    },
    ledgerLookup: {
      async operationExists(operationId: string) {
        return (await ledgerModule.operations.queries.getDetails(operationId)) !== null;
      },
      async treasuryOperationExists(operationId: string) {
        return (await treasuryModule.operations.queries.findById(operationId)) !== null;
      },
    },
    logger,
  });
  const dealExecutionWorkflow = createDealExecutionWorkflow({
    agreements: agreementsModule,
    calculations: calculationsModule,
    currencies: currenciesService,
    db,
    idempotency,
    createDealStore: (tx) => new DrizzleDealStore(tx),
    createDealsModule: createDealsModuleForTransaction,
    createReconciliationService: createReconciliationServiceForTransaction,
    createTreasuryModule: createTreasuryModuleForTransaction,
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
    expireQuotes: async (now: Date) => {
      const expiredQuotes = await treasuryModule.quotes.commands.expireQuotes(now);

      await Promise.all(
        expiredQuotes
          .filter((quote) => quote.dealId)
          .map(async (quote) => {
            await dealsModule.deals.commands.appendTimelineEvent({
              dealId: quote.dealId!,
              payload: {
                expiresAt: quote.expiresAt,
                quoteId: quote.id,
              },
              sourceRef: `quote:${quote.id}:expired`,
              type: "quote_expired",
              visibility: "internal",
            });
          }),
      );

      return expiredQuotes;
    },
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

      const quote = await treasuryModule.quotes.commands.markQuoteUsed({
        ...input,
        dealId,
        usedDocumentId,
      });

      const linkedDealId = quote.dealId ?? dealId;

      if (linkedDealId) {
        await dealsModule.deals.commands.appendTimelineEvent({
          dealId: linkedDealId,
          payload: {
            quoteId: quote.id,
            usedAt: quote.usedAt,
            usedByRef: quote.usedByRef,
            usedDocumentId: quote.usedDocumentId,
          },
          sourceRef: `quote:${quote.id}:used:${quote.usedByRef ?? "unknown"}`,
          type: "quote_used",
          visibility: "internal",
        });
      }

      return quote;
    },
  };
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        calculationReads: calculationsModule.calculations.queries,
        currenciesService,
        dealReads: dealsModule.deals.queries,
        documentsReadModel,
        treasuryExecutionActuals: treasuryModule.operations.queries,
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
  const reconciliationAdjustmentsWorkflow =
    createReconciliationAdjustmentsWorkflow({
      db,
      idempotency,
      createDocumentsService: (tx) => createDocumentsServiceForTransaction(tx),
      createReconciliationService: (tx) =>
        createReconciliationServiceForTransaction(tx),
    });

  const objectStorage = env?.S3_ENDPOINT && env?.S3_ACCESS_KEY && env?.S3_SECRET_KEY
      ? new S3ObjectStorageAdapter({
        endpoint: env.S3_ENDPOINT,
        publicEndpoint: env.S3_PUBLIC_ENDPOINT,
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
  const dealProjectionsWorkflow = createDealProjectionsWorkflow({
    agreements: agreementsModule,
    calculations: calculationsModule,
    currencies: currenciesService,
    deals: dealsModule,
    documentsReadModel,
    files: filesModule,
    iam: iamService,
    parties: partiesModule,
    reconciliation: reconciliationService,
    treasury: treasuryModule,
  });

  // Customer portal workflow
  const customerPortalWorkflow = createCustomerPortalWorkflow({
    currencies: currenciesService,
    deals: dealsModule,
    iam: {
      customerMemberships: customerMembershipsService,
      portalAccessGrants: portalAccessGrantsService,
      users: iamService,
    },
    parties: {
      counterparties: partiesModule.counterparties,
      customers: partiesModule.customers,
      requisites: partiesModule.requisites,
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
    agreements: agreementsModule,
    currencies: currenciesService,
    parties: partiesModule,
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
  const dealAttachmentIngestionWorkflow = createDealAttachmentIngestionWorkflow({
    currencies: currenciesService,
    deals: dealsModule,
    documentExtraction,
    files: filesModule,
    logger,
  });

  return {
    agreementsModule,
    calculationsModule,
    dealsModule,
    reconciliationService,
    filesModule,
    partiesModule,
    currenciesService,
    treasuryModule,
    dealAttachmentIngestionWorkflow,
    dealExecutionWorkflow,
    dealProjectionsWorkflow,
    reconciliationAdjustmentsWorkflow,
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
