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
  createPartiesService,
  type PartiesService,
} from "@bedrock/parties";
import { createPartiesQueries } from "@bedrock/parties/queries";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  createDocumentsService,
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
import { createLedgerBooksService } from "@bedrock/ledger";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/organizations";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@bedrock/requisite-providers";
import type {
  Database,
  Transaction,
} from "@bedrock/platform/persistence";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";

import type { ApiCoreServices } from "./core";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";
import {
  createRequisitesFacadeService,
  type ApiRequisitesFacadeService,
} from "./requisites-facade";
import { createApiRequisitesReadModel } from "./requisites-read-model";
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
  requisiteProvidersService: RequisiteProvidersService;
  requisitesFacadeService: ApiRequisitesFacadeService;
  documentsService: DocumentsService;
}

function createAccountingReportRuntime(database: Database | Transaction) {
  const balancesQueries = createBalancesQueries({ db: database });
  const partiesQueries = createPartiesQueries({ db: database });
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: database });
  const ledgerQueries = createLedgerQueries({ db: database });
  const organizationsQueries = createOrganizationsQueries({ db: database });
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
    reportQueries: createAccountingReportQueries({
      context: reportContext,
    }),
  };
}

function createAccountingPeriodsPort(
  database: Database,
): AccountingPeriodsService {
  function buildService(database: Database | Transaction): AccountingPeriodsService {
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
  ledger: ApiCoreServices["ledger"];
}): DocumentsTransactionsPort {
  return {
    async withTransaction(run) {
      return input.database.transaction(async (tx: Transaction) => {
        const idempotency: DocumentsIdempotencyPort = {
          withIdempotency<
            TResult,
            TStoredResult = Record<string, unknown>,
          >(params: {
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
              tx,
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

        return run({
          moduleRuntime: createDocumentsModuleRuntime(tx),
          documentEvents: createDrizzleDocumentEventsRepository(tx),
          documentLinks: createDrizzleDocumentLinksRepository(tx),
          documentOperations: createDrizzleDocumentOperationsRepository(tx),
          documentsCommand: createDrizzleDocumentsCommandRepository(tx),
          idempotency,
          ledger: {
            commit: (intent) => input.ledger.commit.commit(tx, intent),
          },
        });
      });
    },
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
  const accountingReportRuntime = createAccountingReportRuntime(db);
  const dimensionRegistry = createBedrockDimensionRegistry({
    counterpartiesQueries: partiesQueries.counterparties,
    customersQueries: partiesQueries.customers,
    organizationsQueries: accountingReportRuntime.organizationsQueries,
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
  const partiesService = createPartiesService({
    db,
    logger,
    documents: {
      hasDocumentsForCustomer(customerId, queryable) {
        return createDrizzleDocumentsReadModel({
          db: queryable ?? db,
        }).hasDocumentsForCustomer(customerId);
      },
    },
  });
  const currenciesService = createCurrenciesService({ db, logger });
  const feesService = createFeesService({ db, logger, currenciesService });
  const fxService = createFxService({
    db,
    logger,
    feesService,
    currenciesService,
    rateSourceProviders: createDefaultFxRateSourceProviders(),
  });
  const organizationsService = createOrganizationsService({
    db,
    ledgerBooks: createLedgerBooksService(),
    logger,
  });
  const requisitesReadModel = createApiRequisitesReadModel({ db });
  const requisitesFacadeService = createRequisitesFacadeService({
    readModel: requisitesReadModel,
    organizationsService,
    partiesService,
  });
  const requisiteProvidersService = createRequisiteProvidersService({
    db,
    logger,
  });
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        currenciesService,
        requisitesService: requisitesFacadeService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        currenciesService,
        fxService,
        requisitesService: requisitesFacadeService,
      }),
    ),
  ]);
  const documentsQuery = createDrizzleDocumentsQueryRepository(db);
  const documentEvents = createDrizzleDocumentEventsRepository(db);
  const documentLinks = createDrizzleDocumentLinksRepository(db);
  const documentOperations = createDrizzleDocumentOperationsRepository(db);
  const documentSnapshots = createDrizzleDocumentSnapshotsRepository(db);
  const documentsService = createDocumentsService({
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
      ledger,
    }),
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
    requisiteProvidersService,
    requisitesFacadeService,
    documentsService,
  };
}
