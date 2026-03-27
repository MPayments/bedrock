import { randomUUID } from "node:crypto";

import type { AccountingModule } from "@bedrock/accounting";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import {
  createAccountingPeriodDocumentTransitionEffectsService,
  createDocumentsModule,
  createRuleBasedDocumentActionPolicyService,
  type DocumentsModule,
  type DocumentApprovalRule,
} from "@bedrock/documents";
import {
  DrizzleDocumentEventsRepository,
  DrizzleDocumentLinksRepository,
  DrizzleDocumentOperationsRepository,
  DrizzleDocumentSnapshotsRepository,
  DrizzleDocumentsModuleRuntime,
  DrizzleDocumentsQueries,
  DrizzleDocumentsReadModel,
  DrizzleDocumentsUnitOfWork,
} from "@bedrock/documents/adapters/drizzle";
import type { PartiesModule } from "@bedrock/parties";
import {
  bindPersistenceSession,
  createPersistenceContext,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import type { TreasuryModule } from "@bedrock/treasury";
import { UserNotFoundError } from "@bedrock/users";
import {
  createDocumentDraftWorkflow,
  type DocumentDraftWorkflow,
} from "@bedrock/workflow-document-drafts";
import {
  createDocumentPostingWorkflow,
  type DocumentPostingWorkflow,
} from "@bedrock/workflow-document-posting";
import {
  createIntegrationEventHandler,
  type IntegrationEventHandler,
} from "@bedrock/workflow-integration-mpayments";
import {
  createOrganizationBootstrapWorkflow,
  type OrganizationBootstrapWorkflow,
} from "@bedrock/workflow-organization-bootstrap";
import {
  createRequisiteAccountingWorkflow,
  type RequisiteAccountingWorkflow,
} from "@bedrock/workflow-requisite-accounting";

import { createApiAccountingModule } from "./accounting-module";
import type { ApiCoreServices } from "./core";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";
import { createApiLedgerModule } from "./ledger-module";
import { createApiPartiesModule } from "./parties-module";
import { createApiTreasuryModule } from "./treasury-module";
import { db } from "../db/client";

export interface ApiApplicationServices {
  partiesModule: PartiesModule;
  currenciesService: CurrenciesService;
  treasuryModule: TreasuryModule;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
  documentsModule: DocumentsModule;
  documentDraftWorkflow: DocumentDraftWorkflow;
  documentPostingWorkflow: DocumentPostingWorkflow;
  integrationEventHandler: IntegrationEventHandler;
}

const DEFAULT_DOCUMENT_APPROVAL_RULES: DocumentApprovalRule[] = [
  {
    docTypes: ["period_close", "period_reopen"],
    approvalMode: "maker_checker",
  },
  {
    docTypes: [
      "incoming_invoice",
      "payment_order",
      "outgoing_invoice",
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
): ApiApplicationServices {
  const {
    accountingModule,
    idempotency,
    ledgerModule,
    logger,
    usersService,
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

  const documentsReadModel = new DrizzleDocumentsReadModel(db);
  const currenciesService = createCurrenciesService({ db, logger });
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
    idempotency,
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
    counterpartyGroups: {
      listByCustomerId: (customerId: string) =>
        partiesModule.counterparties.queries.listGroups({
          customerId,
          includeSystem: true,
        }),
    },
  };
  const treasuryQuotes = {
    createQuote: treasuryModule.pricing.quotes.commands.createQuote,
    getQuoteDetails: treasuryModule.pricing.quotes.queries.getQuoteDetails,
    markQuoteUsed: treasuryModule.pricing.quotes.commands.markQuoteUsed,
  };
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        db,
        currenciesService,
        treasuryModule,
        treasuryQuotes,
        ledgerReadService: {
          getOperationDetails: ledgerModule.operations.queries.getDetails,
        },
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
        return (await usersService.findById(actorUserId)).role === "admin";
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

  function createConfiguredDocumentsModule(input: {
    db: typeof db | Transaction;
    persistence: PersistenceContext;
  }) {
    return createDocumentsModule({
      logger,
      now: () => new Date(),
      generateUuid: randomUUID,
      accounting: documentsAccountingPort,
      accountingPeriods: accountingPeriodsPort,
      ledgerReadService: ledgerReadPort,
      documentsQuery: new DrizzleDocumentsQueries(input.db),
      documentEvents: new DrizzleDocumentEventsRepository(input.db),
      documentLinks: new DrizzleDocumentLinksRepository(input.db),
      documentOperations: new DrizzleDocumentOperationsRepository(input.db),
      documentSnapshots: new DrizzleDocumentSnapshotsRepository(input.db),
      moduleRuntime: new DrizzleDocumentsModuleRuntime(input.db),
      registry: documentRegistry,
      policy: documentsPolicy,
      transitionEffects: documentTransitionEffects,
      unitOfWork: new DrizzleDocumentsUnitOfWork({
        persistence: input.persistence,
        idempotency,
      }),
    });
  }

  const documentsCoreModule = createConfiguredDocumentsModule({
    db,
    persistence: createPersistenceContext(db),
  });

  function createDocumentsModuleForTransaction(tx: Transaction) {
    return createConfiguredDocumentsModule({
      db: tx,
      persistence: bindPersistenceSession(tx),
    });
  }
  const documentsModule = documentsCoreModule;
  const documentDraftWorkflow = createDocumentDraftWorkflow({
    db,
    createDocumentsModule: createDocumentsModuleForTransaction,
  });
  const documentPostingWorkflow = createDocumentPostingWorkflow({
    db,
    idempotency,
    createLedgerModule: createLedgerModuleForTransaction,
    createDocumentsModule: createDocumentsModuleForTransaction,
  });

  const integrationEventHandler = createIntegrationEventHandler({
    createCustomer: partiesModule.customers.commands.create,
    listCustomers: partiesModule.customers.queries.list,
    createCounterparty: partiesModule.counterparties.commands.create,
    listCounterparties: partiesModule.counterparties.queries.list,
    createRequisite: partiesModule.requisites.commands.create,
    listProviders: partiesModule.requisites.queries.listProviders,
    createProvider: partiesModule.requisites.commands.createProvider,
    findCurrencyByCode: currenciesService.findByCode,
    logger,
  });

  return {
    partiesModule,
    currenciesService,
    treasuryModule,
    organizationBootstrapWorkflow,
    requisiteAccountingWorkflow,
    documentsModule,
    documentDraftWorkflow,
    documentPostingWorkflow,
    integrationEventHandler,
  };
}
