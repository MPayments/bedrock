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
  createDocumentsService,
  createDocumentsServiceFromTransaction,
  type DocumentsIdempotencyPort,
  type DocumentsService,
  type DocumentsTransactionsPort,
} from "@bedrock/documents";
import type { DocumentModuleRuntime } from "@bedrock/documents/plugins";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import {
  createDrizzleDocumentEventsRepository,
  createDrizzleDocumentLinksRepository,
  createDrizzleDocumentOperationsRepository,
  createDrizzleDocumentSnapshotsRepository,
  createDrizzleDocumentsCommandRepository,
  createDrizzleDocumentsQueryRepository,
} from "@bedrock/documents/repository";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createDefaultFxRateSourceProviders } from "@bedrock/fx/providers";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/organizations";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
import { createPartiesService, type PartiesService } from "@bedrock/parties";
import { createPartiesQueries } from "@bedrock/parties/queries";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import {
  createRequisitesService,
  type RequisitesService,
} from "@bedrock/requisites";
import { createRequisitesQueries } from "@bedrock/requisites/queries";
import {
  createDocumentDraftWorkflow,
  type DocumentDraftWorkflow,
} from "@bedrock/workflow-document-drafts";
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

import type { ApiCoreServices } from "./core";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";
import { db } from "../db/client";

function createDocumentsModuleRuntime(
  database: Database | Transaction,
): DocumentModuleRuntime {
  return {
    documents: createDrizzleDocumentsReadModel({ db: database }),
    withQueryable: (run) => run(database),
  };
}

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
}

function createAccountingReportRuntime(database: Database | Transaction) {
  const balancesQueries = createBalancesQueries({ db: database });
  const partiesQueries = createPartiesQueries({ db: database });
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: database });
  const ledgerQueries = createLedgerQueries({ db: database });
  const organizationsQueries = createOrganizationsQueries({ db: database });
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

function createDocumentsTransactions(input: {
  database: Database;
  idempotency: ApiCoreServices["idempotency"];
}): DocumentsTransactionsPort {
  return {
    async withTransaction(run) {
      return input.database.transaction(async (tx: Transaction) =>
        run(
          createDocumentsTransactionContext({
            tx,
            idempotency: input.idempotency,
          }),
        ),
      );
    },
  };
}

function createDocumentsTransactionContext(input: {
  tx: Transaction;
  idempotency: ApiCoreServices["idempotency"];
}) {
  const idempotency: DocumentsIdempotencyPort = {
    withIdempotency<TResult, TStoredResult = Record<string, unknown>>(params: {
      scope: string;
      idempotencyKey: string;
      request: unknown;
      actorId?: string | null;
      handler: () => Promise<TResult>;
      serializeResult: (result: TResult) => TStoredResult;
      loadReplayResult: (params: {
        storedResult: TStoredResult | null;
      }) => Promise<TResult>;
      serializeError?: (error: unknown) => Record<string, unknown>;
    }) {
      return input.idempotency.withIdempotencyTx<TResult, TStoredResult>({
        tx: input.tx,
        scope: params.scope,
        idempotencyKey: params.idempotencyKey,
        request: params.request,
        actorId: params.actorId,
        handler: params.handler,
        serializeResult: params.serializeResult,
        loadReplayResult: ({ storedResult }) =>
          params.loadReplayResult({
            storedResult: (storedResult as TStoredResult | null) ?? null,
          }),
        serializeError: params.serializeError,
      });
    },
  };

  return {
    moduleRuntime: createDocumentsModuleRuntime(input.tx),
    documentEvents: createDrizzleDocumentEventsRepository(input.tx),
    documentLinks: createDrizzleDocumentLinksRepository(input.tx),
    documentOperations: createDrizzleDocumentOperationsRepository(input.tx),
    documentsCommand: createDrizzleDocumentsCommandRepository(input.tx),
    idempotency,
  };
}

export function createApplicationServices(
  platform: ApiCoreServices,
): ApiApplicationServices {
  const { accountingService, idempotency, ledger, ledgerReadService, logger } =
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
    db,
    logger,
    feesService,
    currenciesService,
    rateSourceProviders: createDefaultFxRateSourceProviders(),
  });
  const partiesService = createPartiesService({
    db,
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
    db,
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
    db,
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
  const documentsQuery = createDrizzleDocumentsQueryRepository(db);
  const documentEvents = createDrizzleDocumentEventsRepository(db);
  const documentLinks = createDrizzleDocumentLinksRepository(db);
  const documentOperations = createDrizzleDocumentOperationsRepository(db);
  const documentSnapshots = createDrizzleDocumentSnapshotsRepository(db);
  const documentsCoreService = createDocumentsService({
    accounting: accountingService.packs,
    accountingPeriods: accountingPeriodsService,
    documentEvents,
    documentLinks,
    documentOperations,
    documentSnapshots,
    documentsQuery,
    ledgerReadService,
    moduleRuntime: createDocumentsModuleRuntime(db),
    registry: documentRegistry,
    transactions: createDocumentsTransactions({
      database: db,
      idempotency,
    }),
    logger,
  });

  function createDocumentsServiceForTransaction(
    tx: Transaction,
    txIdempotency: DocumentsIdempotencyPort,
  ) {
    return createDocumentsServiceFromTransaction({
      tx,
      idempotency: txIdempotency,
      accounting: accountingService.packs,
      accountingPeriods: accountingPeriodsService,
      ledgerReadService,
      registry: documentRegistry,
      logger,
    });
  }
  const documentsService = documentsCoreService;
  const documentDraftWorkflow = createDocumentDraftWorkflow({
    db,
    idempotency,
    accountingPeriods: accountingPeriodsService,
    createDocumentsService: createDocumentsServiceForTransaction,
  });
  const documentPostingWorkflow = createDocumentPostingWorkflow({
    db,
    idempotency,
    ledgerCommit: ledger.commit,
    createDocumentsService: createDocumentsServiceForTransaction,
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
  };
}
