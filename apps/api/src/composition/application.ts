import {
  createAccountingClosePackageSnapshotPort,
  createAccountingPeriodsService,
  createDrizzleAccountingPeriodsRepository,
  type AccountingPeriodsService,
} from "@bedrock/accounting/periods";
import {
  createAccountingReportQueries,
  createAccountingReportsContext,
  createAccountingReportsService,
  createBedrockDimensionRegistry,
  createDrizzleAccountingReportsRepository,
  type AccountingReportsService,
} from "@bedrock/accounting/reports";
import { createBalancesQueries } from "@bedrock/balances/queries";
import {
  createCustomerLifecycleSyncPort,
  createCounterpartiesService,
  type CounterpartiesService,
} from "@bedrock/counterparties";
import { createCounterpartiesQueries } from "@bedrock/counterparties/queries";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  createCustomersService,
  type CustomersService,
} from "@bedrock/customers";
import { createCustomersQueries } from "@bedrock/customers/queries";
import {
  createDocumentsService,
  type DocumentsIdempotencyPort,
  type DocumentsService,
  type DocumentsTransactionsPort,
} from "@bedrock/documents";
import type { DocumentModuleRuntime } from "@bedrock/documents/plugins";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import { createDrizzleDocumentsRepository } from "@bedrock/documents/repository";
import { createFeesService, type FeesService } from "@bedrock/fees";
import { createFxService, type FxService } from "@bedrock/fx";
import { createDefaultFxRateSourceProviders } from "@bedrock/fx/infra/providers";
import { createLedgerBooksService } from "@bedrock/ledger";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import {
  createOrganizationsService,
  type OrganizationsService,
} from "@bedrock/organizations";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import { createCommercialDocumentModules } from "@bedrock/plugin-documents-commercial";
import { createIfrsDocumentModules } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import {
  createRequisitesService,
  type RequisitesService,
} from "@bedrock/requisites";
import {
  createRequisiteProvidersService,
  type RequisiteProvidersService,
} from "@bedrock/requisites/providers";
import { createRequisitesQueries } from "@bedrock/requisites/queries";

import type { ApiCoreServices } from "./core";
import {
  createCommercialDocumentDeps,
  createIfrsDocumentDeps,
} from "./document-plugin-adapters";
import { db } from "../db/client";

type Queryable = Database | Transaction;

function createDocumentsModuleRuntime(queryable: Queryable): DocumentModuleRuntime {
  return {
    documents: createDrizzleDocumentsReadModel({ db: queryable }),
    withQueryable: (run) => run(queryable),
  };
}

export interface ApiApplicationServices {
  accountingReportsService: AccountingReportsService;
  accountingPeriodsService: AccountingPeriodsService;
  counterpartiesService: CounterpartiesService;
  customersService: CustomersService;
  currenciesService: CurrenciesService;
  feesService: FeesService;
  fxService: FxService;
  organizationsService: OrganizationsService;
  requisiteProvidersService: RequisiteProvidersService;
  requisitesService: RequisitesService;
  documentsService: DocumentsService;
}

function createAccountingReportRuntime(queryable: Queryable) {
  const balancesQueries = createBalancesQueries({ db: queryable });
  const counterpartiesQueries = createCounterpartiesQueries({ db: queryable });
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: queryable });
  const ledgerQueries = createLedgerQueries({ db: queryable });
  const organizationsQueries = createOrganizationsQueries({ db: queryable });
  const reportsRepository = createDrizzleAccountingReportsRepository(queryable);
  const reportContext = createAccountingReportsContext({
    balancesQueries,
    counterpartiesQueries,
    documentsPort: documentsReadModel,
    ledgerQueries,
    organizationsQueries,
    reportsRepository,
  });

  return {
    counterpartiesQueries,
    ledgerQueries,
    organizationsQueries,
    reportQueries: createAccountingReportQueries({
      context: reportContext,
    }),
  };
}

function createAccountingPeriodsPort(database: Database): AccountingPeriodsService {
  function buildService(queryable: Queryable): AccountingPeriodsService {
    const { ledgerQueries, organizationsQueries, reportQueries } =
      createAccountingReportRuntime(queryable);
    const repository = createDrizzleAccountingPeriodsRepository(queryable);

    return createAccountingPeriodsService({
      repository,
      closePackageSnapshotPort: createAccountingClosePackageSnapshotPort({
        repository,
        assertInternalLedgerOrganization:
          organizationsQueries.assertInternalLedgerOrganization,
        listBooksByOwnerId: ledgerQueries.listBooksByOwnerId,
        reportQueries,
        documentsReadModel: createDrizzleDocumentsReadModel({ db: queryable }),
      }),
    });
  }

  async function runWithService<T>(input: {
    db?: Queryable;
    transactional?: boolean;
    run: (service: AccountingPeriodsService) => Promise<T>;
  }) {
    const execute = (queryable: Queryable) => input.run(buildService(queryable));

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
        db: (input as { db?: Queryable }).db,
        run: (service) =>
          service.isOrganizationPeriodClosed({
            organizationId: input.organizationId,
            occurredAt: input.occurredAt,
          }),
      });
    },
    assertOrganizationPeriodsOpen(input) {
      return runWithService({
        db: (input as { db?: Queryable }).db,
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
        db: (input as { db?: Queryable }).db,
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
        db: (input as { db?: Queryable }).db,
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
          withIdempotency<TResult, TStoredResult = Record<string, unknown>>(
            params: {
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
            },
          ) {
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
          repository: createDrizzleDocumentsRepository(tx),
          idempotency,
          ledger: {
            commit: (intent) => input.ledger.commit(tx, intent),
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
  const customersQueries = createCustomersQueries({ db });
  const requisitesQueries = createRequisitesQueries({ db });
  const accountingReportRuntime = createAccountingReportRuntime(db);
  const dimensionRegistry = createBedrockDimensionRegistry({
    counterpartiesQueries: accountingReportRuntime.counterpartiesQueries,
    customersQueries,
    requisitesQueries,
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
  const counterpartiesService = createCounterpartiesService({ db, logger });
  const customersService = createCustomersService({
    db,
    customerLifecycleSyncPort: createCustomerLifecycleSyncPort(),
    logger,
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
  const requisiteProvidersService = createRequisiteProvidersService({
    db,
    logger,
  });
  const requisitesService = createRequisitesService({
    db,
    logger,
  });
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        currenciesService,
        requisitesService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        currenciesService,
        fxService,
        requisitesService,
      }),
    ),
  ]);
  const documentsService = createDocumentsService({
    accounting: accountingService,
    accountingPeriods: accountingPeriodsService,
    ledgerReadService,
    moduleRuntime: createDocumentsModuleRuntime(db),
    repository: createDrizzleDocumentsRepository(db),
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
    counterpartiesService,
    customersService,
    currenciesService,
    feesService,
    fxService,
    organizationsService,
    requisiteProvidersService,
    requisitesService,
    documentsService,
  };
}
