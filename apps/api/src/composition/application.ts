import {
  createAccountingClosePackageSnapshotPort,
  createAccountingReportQueries,
  createAccountingReportsContext,
  createAccountingReportsService,
  createBedrockDimensionRegistry,
  createDrizzleAccountingPeriodsCommandRepository,
  createDrizzleAccountingPeriodsQueryRepository,
  createDrizzleAccountingReportsRepository,
  createAccountingPeriodsService,
  type AccountingPeriodsService,
  type AccountingReportsService,
} from "@bedrock/accounting";
import { createBalancesQueries } from "@bedrock/balances/queries";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  createAccountingPeriodDocumentTransitionEffectsService,
  createDocumentsService,
  createRuleBasedDocumentActionPolicyService,
  type DocumentsService,
  type DocumentApprovalRule,
} from "@bedrock/documents";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createDefaultFxRateSourceProviders } from "@bedrock/fx/providers";
import {
  createLedgerQueries,
  type LedgerBookRow,
  type LedgerQueries,
} from "@bedrock/ledger/queries";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/organizations";
import {
  createOrganizationsQueries,
  type OrganizationsQueries,
} from "@bedrock/organizations/queries";
import { createPartiesService, type PartiesService } from "@bedrock/parties";
import { createPartiesQueries } from "@bedrock/parties/queries";
import {
  bindPersistenceSession,
  createPersistenceContext,
  type Database,
  type Transaction,
} from "@bedrock/platform/persistence";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import {
  createRequisitesService,
  type RequisitesService,
} from "@bedrock/requisites";
import { createRequisitesQueries } from "@bedrock/requisites/queries";
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

import { relabelOrganizationBookNames } from "./book-labels";
import type { ApiCoreServices } from "./core";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";
import { db } from "../db/client";

export interface ApiApplicationServices {
  accountingReportsService: AccountingReportsService;
  accountingPeriodsService: AccountingPeriodsService;
  partiesService: PartiesService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  organizationsService: OrganizationsService;
  organizationBootstrapWorkflow: OrganizationBootstrapWorkflow;
  requisitesService: RequisitesService;
  requisiteAccountingWorkflow: RequisiteAccountingWorkflow;
  documentsService: DocumentsService;
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

async function listBooksWithLabels(input: {
  ids: string[];
  ledgerQueries: Pick<LedgerQueries, "listBooksById">;
  organizationsQueries: Pick<OrganizationsQueries, "listShortNamesById">;
}): Promise<LedgerBookRow[]> {
  const books = await input.ledgerQueries.listBooksById(input.ids);
  const ownerIds = Array.from(
    new Set(books.map((book) => book.ownerId).filter(Boolean)),
  ) as string[];
  const organizationShortNamesById =
    ownerIds.length === 0
      ? new Map<string, string>()
      : await input.organizationsQueries.listShortNamesById(ownerIds);

  return relabelOrganizationBookNames({
    books,
    organizationShortNamesById,
  });
}

function createAccountingReportRuntime(database: Database | Transaction) {
  const balancesQueries = createBalancesQueries({ db: database });
  const partiesQueries = createPartiesQueries({ db: database });
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: database });
  const organizationsQueries = createOrganizationsQueries({ db: database });
  const rawLedgerQueries = createLedgerQueries({ db: database });
  const ledgerQueries: LedgerQueries = {
    ...rawLedgerQueries,
    listBooksById: (ids) =>
      listBooksWithLabels({
        ids,
        ledgerQueries: rawLedgerQueries,
        organizationsQueries,
      }),
  };
  const requisitesQueries = createRequisitesQueries({ db: database });
  const reportsRepository = createDrizzleAccountingReportsRepository(database);
  const reportContext = createAccountingReportsContext({
    balancesQueries,
    counterpartiesQueries: partiesQueries.counterparties,
    documentsPort: documentsReadModel,
    ledgerQueries,
    organizationsQueries,
    reportsRepository,
  });

  return {
    partiesQueries,
    ledgerQueries,
    organizationsQueries,
    requisitesQueries,
    reportQueries: createAccountingReportQueries({
      context: reportContext,
    }),
  };
}

function createAccountingPeriodsPort(
  database: Database,
): AccountingPeriodsService {
  function buildService(
    database: Database | Transaction,
  ): AccountingPeriodsService {
    const { ledgerQueries, organizationsQueries, reportQueries } =
      createAccountingReportRuntime(database);
    const queries = createDrizzleAccountingPeriodsQueryRepository(database);
    const commands = createDrizzleAccountingPeriodsCommandRepository(database);

    return createAccountingPeriodsService({
      queries,
      commands,
      closePackageSnapshotPort: createAccountingClosePackageSnapshotPort({
        repository: commands,
        assertInternalLedgerOrganization:
          organizationsQueries.assertInternalLedgerOrganization,
        listBooksByOwnerId: ledgerQueries.listBooksByOwnerId,
        reportQueries,
        documentsReadModel: createDrizzleDocumentsReadModel({ db: database }),
      }),
    });
  }

  async function runWithService<T>(input: {
    db?: Database | Transaction;
    transactional?: boolean;
    run: (service: AccountingPeriodsService) => Promise<T>;
  }) {
    const execute = (database: Database | Transaction) =>
      input.run(buildService(database));

    if (input.db) {
      return execute(input.db);
    }

    if (input.transactional) {
      return database.transaction((tx) => execute(tx));
    }

    return execute(database);
  }

  return {
    isOrganizationPeriodClosed(input) {
      return runWithService({
        db: (input as { db?: Database | Transaction }).db,
        run: (service) =>
          service.isOrganizationPeriodClosed({
            organizationId: input.organizationId,
            occurredAt: input.occurredAt,
          }),
      });
    },
    listClosedOrganizationIdsForPeriod(input) {
      return runWithService({
        db: (input as { db?: Database | Transaction }).db,
        run: (service) =>
          service.listClosedOrganizationIdsForPeriod({
            organizationIds: input.organizationIds,
            occurredAt: input.occurredAt,
          }),
      });
    },
    assertOrganizationPeriodsOpen(input) {
      return runWithService({
        db: (input as { db?: Database | Transaction }).db,
        run: (service) =>
          service.assertOrganizationPeriodsOpen({
            occurredAt: input.occurredAt,
            organizationIds: input.organizationIds,
            docType: input.docType,
          }),
      });
    },
    closePeriod(input) {
      return runWithService({
        db: (input as { db?: Database | Transaction }).db,
        transactional: true,
        run: (service) =>
          service.closePeriod({
            organizationId: input.organizationId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            closedBy: input.closedBy,
            closeReason: input.closeReason,
            closeDocumentId: input.closeDocumentId,
          }),
      });
    },
    reopenPeriod(input) {
      return runWithService({
        db: (input as { db?: Database | Transaction }).db,
        transactional: true,
        run: (service) =>
          service.reopenPeriod({
            organizationId: input.organizationId,
            periodStart: input.periodStart,
            reopenedBy: input.reopenedBy,
            reopenReason: input.reopenReason,
            reopenDocumentId: input.reopenDocumentId,
          }),
      });
    },
  };
}

export function createApplicationServices(
  platform: ApiCoreServices,
): ApiApplicationServices {
  const {
    accountingService,
    idempotency,
    ledger,
    ledgerReadService,
    logger,
    usersService,
  } =
    platform;

  const documentsReadModel = createDrizzleDocumentsReadModel({ db });
  const currenciesQueries = createCurrenciesQueries({ db });
  const partiesQueries = createPartiesQueries({ db });
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
  const accountingReportRuntime = createAccountingReportRuntime(db);
  const dimensionRegistry = createBedrockDimensionRegistry({
    counterpartiesQueries: partiesQueries.counterparties,
    customersQueries: partiesQueries.customers,
    organizationsQueries: accountingReportRuntime.organizationsQueries,
    requisitesQueries: accountingReportRuntime.requisitesQueries,
    documentsReadModel,
  });
  const accountingReportsService = createAccountingReportsService({
    ledgerReadPort: ledgerReadService,
    listBookNamesById: async (ids) =>
      new Map(
        (await accountingReportRuntime.ledgerQueries.listBooksById(ids)).map(
          (row) => [row.id, row.name ?? row.id],
        ),
      ),
    listCurrencyPrecisionsByCode: currenciesQueries.listPrecisionsByCode,
    resolveDimensionLabelsFromRecords:
      dimensionRegistry.resolveLabelsFromDimensionRecords,
    reportQueries: accountingReportRuntime.reportQueries,
  });
  const accountingPeriodsService = createAccountingPeriodsPort(db);
  const feesService = createFeesService({ db, logger, currenciesService });
  const fxService = createFxService({
    persistence: createPersistenceContext(db),
    logger,
    feesService,
    currenciesService,
    rateSourceProviders: createDefaultFxRateSourceProviders(),
  });
  const partiesService = createPartiesService({
    persistence: createPersistenceContext(db),
    documents: {
      hasDocumentsForCustomer(customerId, queryable) {
        return createDrizzleDocumentsReadModel({
          db: (queryable as Database | undefined) ?? db,
        }).hasDocumentsForCustomer(customerId);
      },
    },
    logger,
  });
  const organizationsCoreService = createOrganizationsService({
    persistence: createPersistenceContext(db),
    logger,
  });
  const requisiteOwners = {
    async assertOrganizationExists(organizationId: string) {
      await organizationsCoreService.findById(organizationId);
    },
    async assertCounterpartyExists(counterpartyId: string) {
      await partiesService.counterparties.findById(counterpartyId);
    },
  };
  const requisitesCoreService = createRequisitesService({
    persistence: createPersistenceContext(db),
    logger,
    currencies: currenciesPort,
    owners: requisiteOwners,
  });

  const organizationsService = organizationsCoreService;
  const organizationBootstrapWorkflow = createOrganizationBootstrapWorkflow({
    db,
    ledgerBooks: ledger.books,
    logger,
  });
  const requisitesService = requisitesCoreService;
  const requisiteAccountingWorkflow = createRequisiteAccountingWorkflow({
    db,
    ledgerBooks: ledger.books,
    ledgerBookAccounts: ledger.bookAccounts,
    currencies: currenciesPort,
    owners: requisiteOwners,
    logger,
  });
  const documentRequisitesService = {
    findById: requisitesService.findById,
    resolveBindings: requisitesService.bindings.resolve,
  };
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        currenciesService,
        fxQuotes: fxService.quotes,
        partiesService,
        requisitesService: documentRequisitesService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        currenciesService,
        fxQuotes: fxService.quotes,
        ledgerReadService,
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
  const documentsCoreService = createDocumentsService({
    persistence: createPersistenceContext(db),
    idempotency,
    accounting: accountingService.packs,
    accountingPeriods: accountingPeriodsService,
    ledgerReadService,
    policy: documentsPolicy,
    registry: documentRegistry,
    transitionEffects: documentTransitionEffects,
    logger,
  });

  function createDocumentsServiceForTransaction(tx: Transaction) {
    return createDocumentsService({
      persistence: bindPersistenceSession(tx),
      idempotency,
      accounting: accountingService.packs,
      accountingPeriods: accountingPeriodsService,
      ledgerReadService,
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
    ledgerCommit: ledger.commit,
    createDocumentsService: createDocumentsServiceForTransaction,
  });

  const integrationEventHandler = createIntegrationEventHandler({
    createCustomer: partiesService.customers.create,
    listCustomers: partiesService.customers.list,
    createCounterparty: partiesService.counterparties.create,
    listCounterparties: partiesService.counterparties.list,
    createRequisite: requisitesCoreService.create,
    listProviders: requisitesCoreService.providers.list,
    createProvider: requisitesCoreService.providers.create,
    findCurrencyByCode: currenciesService.findByCode,
    logger,
  });

  return {
    accountingReportsService,
    accountingPeriodsService,
    partiesService,
    currenciesService,
    feesService,
    fxService,
    organizationsService,
    organizationBootstrapWorkflow,
    requisitesService,
    requisiteAccountingWorkflow,
    documentsService,
    documentDraftWorkflow,
    documentPostingWorkflow,
    integrationEventHandler,
  };
}
