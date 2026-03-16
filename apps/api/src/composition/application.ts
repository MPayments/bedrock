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
import { ACCOUNT_NO } from "@bedrock/accounting/constants";
import { createBalancesQueries } from "@bedrock/balances/queries";
import {
  createCurrenciesService,
  type CurrenciesService,
} from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  createDocumentsService,
  DocumentValidationError,
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
import type { OperationIntent } from "@bedrock/ledger/contracts";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import {
  createOrganizationsService,
  createOrganizationsServiceFromTransaction,
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
  createRequisitesServiceFromTransaction,
  RequisiteAccountingBindingOwnerTypeError,
  RequisiteNotFoundError,
} from "@bedrock/requisites";
import { createRequisitesQueries } from "@bedrock/requisites/queries";

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
  organizationsService: ApiOrganizationsService;
  requisitesService: ApiRequisitesService;
  documentsService: DocumentsService;
}

export interface ApiOrganizationsService {
  list: ReturnType<typeof createOrganizationsService>["list"];
  findById: ReturnType<typeof createOrganizationsService>["findById"];
  create: ReturnType<typeof createOrganizationsService>["create"];
  update: ReturnType<typeof createOrganizationsService>["update"];
  remove: ReturnType<typeof createOrganizationsService>["remove"];
}

export interface ApiRequisitesService extends Omit<
  ReturnType<typeof createRequisitesService>,
  "bindings"
> {
  bindings: {
    get: ReturnType<typeof createRequisitesService>["bindings"]["get"];
    resolve: ReturnType<typeof createRequisitesService>["bindings"]["resolve"];
    upsert: (
      requisiteId: string,
      input: { postingAccountNo: string },
    ) => ReturnType<
      ReturnType<typeof createRequisitesService>["bindings"]["get"]
    >;
  };
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
  ledger: ApiCoreServices["ledger"];
}): DocumentsTransactionsPort {
  return {
    async withTransaction(run) {
      return input.database.transaction(async (tx: Transaction) =>
        run(
          createDocumentsTransactionContext({
            tx,
            idempotency: input.idempotency,
            ledger: input.ledger,
          }),
        ),
      );
    },
  };
}

function createDocumentsTransactionContext(input: {
  tx: Transaction;
  idempotency: ApiCoreServices["idempotency"];
  ledger: ApiCoreServices["ledger"];
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
    ledger: {
      commit: (intent: OperationIntent) =>
        input.ledger.commit.commit(input.tx, intent),
    },
  };
}

function readDocumentPayloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readDocumentPayloadDate(
  payload: Record<string, unknown>,
  key: string,
  fallback: Date,
): Date {
  const raw = payload[key];
  if (typeof raw === "string" || raw instanceof Date) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }

  return fallback;
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
          db: queryable ?? db,
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

  async function upsertOrganizationRequisiteBindingTx(input: {
    tx: Transaction;
    requisiteId: string;
    organizationId: string;
    currencyCode: string;
    postingAccountNo?: string;
  }) {
    const postingAccountNo = input.postingAccountNo ?? ACCOUNT_NO.BANK;
    const { bookId } = await ledger.books.ensureDefaultOrganizationBook(
      input.tx,
      {
        organizationId: input.organizationId,
      },
    );
    const bookAccount = await ledger.bookAccounts.ensureBookAccountInstance(
      input.tx,
      {
        bookId,
        accountNo: postingAccountNo,
        currency: input.currencyCode,
        dimensions: {},
      },
    );

    const txRequisitesService = createRequisitesServiceFromTransaction({
      tx: input.tx,
      logger,
      currencies: currenciesPort,
      owners: requisiteOwners,
    });

    await txRequisitesService.bindings.upsert({
      requisiteId: input.requisiteId,
      bookId,
      bookAccountInstanceId: bookAccount.id,
      postingAccountNo,
    });

    return txRequisitesService.bindings.get(input.requisiteId);
  }

  async function syncOrganizationRequisiteBindingForRequisiteTx(input: {
    tx: Transaction;
    requisite: Awaited<ReturnType<typeof requisitesCoreService.findById>>;
    postingAccountNo?: string;
  }) {
    if (input.requisite.ownerType !== "organization") {
      return null;
    }

    const currency = await currenciesService.findById(
      input.requisite.currencyId,
    );

    return upsertOrganizationRequisiteBindingTx({
      tx: input.tx,
      requisiteId: input.requisite.id,
      organizationId: input.requisite.ownerId,
      currencyCode: currency.code,
      postingAccountNo: input.postingAccountNo,
    });
  }

  const organizationsService: ApiOrganizationsService = {
    list: organizationsCoreService.list,
    findById: organizationsCoreService.findById,
    async create(input) {
      return db.transaction(async (tx) => {
        const txOrganizationsService =
          createOrganizationsServiceFromTransaction({
            tx,
            logger,
          });
        const organization = await txOrganizationsService.create(input);

        await ledger.books.ensureDefaultOrganizationBook(tx, {
          organizationId: organization.id,
        });

        return organization;
      });
    },
    async update(id, input) {
      return db.transaction(async (tx) =>
        createOrganizationsServiceFromTransaction({
          tx,
          logger,
        }).update(id, input),
      );
    },
    async remove(id) {
      return db.transaction(async (tx) =>
        createOrganizationsServiceFromTransaction({
          tx,
          logger,
        }).remove(id),
      );
    },
  };
  const requisitesService: ApiRequisitesService = {
    list: requisitesCoreService.list,
    listOptions: requisitesCoreService.listOptions,
    findById: requisitesCoreService.findById,
    async create(input) {
      return db.transaction(async (tx) => {
        const txRequisitesService = createRequisitesServiceFromTransaction({
          tx,
          logger,
          currencies: currenciesPort,
          owners: requisiteOwners,
        });
        const requisite = await txRequisitesService.create(input);

        await syncOrganizationRequisiteBindingForRequisiteTx({
          tx,
          requisite,
        });

        return requisite;
      });
    },
    async update(id, input) {
      return db.transaction(async (tx) => {
        const txRequisitesService = createRequisitesServiceFromTransaction({
          tx,
          logger,
          currencies: currenciesPort,
          owners: requisiteOwners,
        });
        const requisite = await txRequisitesService.update(id, input);

        await syncOrganizationRequisiteBindingForRequisiteTx({
          tx,
          requisite,
        });

        return requisite;
      });
    },
    remove: requisitesCoreService.remove,
    bindings: {
      get: requisitesCoreService.bindings.get,
      resolve: requisitesCoreService.bindings.resolve,
      async upsert(requisiteId, input) {
        return db.transaction(async (tx) => {
          const txRequisitesQueries = createRequisitesQueries({ db: tx });
          const subject =
            await txRequisitesQueries.findSubjectById(requisiteId);

          if (!subject) {
            throw new RequisiteNotFoundError(requisiteId);
          }

          if (subject.ownerType !== "organization" || !subject.organizationId) {
            throw new RequisiteAccountingBindingOwnerTypeError(requisiteId);
          }

          return upsertOrganizationRequisiteBindingTx({
            tx,
            requisiteId,
            organizationId: subject.organizationId,
            currencyCode: subject.currencyCode,
            postingAccountNo: input.postingAccountNo,
          });
        });
      },
    },
    providers: requisitesCoreService.providers,
  };
  const documentRequisitesService = {
    findById: requisitesService.findById,
    resolveBindings: requisitesService.bindings.resolve,
  };
  const documentRegistry = createDocumentRegistry([
    ...createCommercialDocumentModules(
      createCommercialDocumentDeps({
        currenciesService,
        requisitesService: documentRequisitesService,
      }),
    ),
    ...createIfrsDocumentModules(
      createIfrsDocumentDeps({
        currenciesService,
        fxService,
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
      ledger,
    }),
    logger,
  });

  function createDocumentsServiceForTransaction(tx: Transaction) {
    return createDocumentsService({
      accounting: accountingService.packs,
      accountingPeriods: accountingPeriodsService,
      documentEvents: createDrizzleDocumentEventsRepository(tx),
      documentLinks: createDrizzleDocumentLinksRepository(tx),
      documentOperations: createDrizzleDocumentOperationsRepository(tx),
      documentSnapshots: createDrizzleDocumentSnapshotsRepository(tx),
      documentsQuery: createDrizzleDocumentsQueryRepository(tx),
      ledgerReadService,
      moduleRuntime: createDocumentsModuleRuntime(tx),
      registry: documentRegistry,
      transactions: {
        withTransaction: (run) =>
          run(
            createDocumentsTransactionContext({
              tx,
              idempotency,
              ledger,
            }),
          ),
      },
      logger,
    });
  }

  async function applyDraftPeriodMutation(input: {
    tx: Transaction;
    actorUserId: string;
    result: Awaited<ReturnType<typeof documentsCoreService.createDraft>>;
  }) {
    const payload = input.result.document.payload as Record<string, unknown>;

    if (input.result.document.docType === "period_close") {
      const organizationId = readDocumentPayloadString(
        payload,
        "organizationId",
      );
      if (!organizationId) {
        throw new DocumentValidationError(
          "period_close payload requires organizationId",
        );
      }

      const closePeriodInput = {
        organizationId,
        periodStart: readDocumentPayloadDate(
          payload,
          "periodStart",
          input.result.document.occurredAt,
        ),
        periodEnd: readDocumentPayloadDate(
          payload,
          "periodEnd",
          input.result.document.occurredAt,
        ),
        closedBy: input.actorUserId,
        closeReason: readDocumentPayloadString(payload, "closeReason"),
        closeDocumentId: input.result.document.id,
        db: input.tx,
      } as Parameters<AccountingPeriodsService["closePeriod"]>[0];

      await accountingPeriodsService.closePeriod(closePeriodInput);
      return;
    }

    if (input.result.document.docType === "period_reopen") {
      const organizationId = readDocumentPayloadString(
        payload,
        "organizationId",
      );
      if (!organizationId) {
        throw new DocumentValidationError(
          "period_reopen payload requires organizationId",
        );
      }

      const reopenPeriodInput = {
        organizationId,
        periodStart: readDocumentPayloadDate(
          payload,
          "periodStart",
          input.result.document.occurredAt,
        ),
        reopenedBy: input.actorUserId,
        reopenReason: readDocumentPayloadString(payload, "reopenReason"),
        reopenDocumentId: input.result.document.id,
        db: input.tx,
      } as Parameters<AccountingPeriodsService["reopenPeriod"]>[0];

      await accountingPeriodsService.reopenPeriod(reopenPeriodInput);
    }
  }

  const documentsService: DocumentsService = {
    list: documentsCoreService.list,
    get: documentsCoreService.get,
    getDetails: documentsCoreService.getDetails,
    validateAccountingSourceCoverage:
      documentsCoreService.validateAccountingSourceCoverage,
    async createDraft(input) {
      return db.transaction(async (tx) => {
        const txDocumentsService = createDocumentsServiceForTransaction(tx);
        const result = await txDocumentsService.createDraft(input);

        await applyDraftPeriodMutation({
          tx,
          actorUserId: input.actorUserId,
          result,
        });

        return result;
      });
    },
    async updateDraft(input) {
      return db.transaction(async (tx) =>
        createDocumentsServiceForTransaction(tx).updateDraft(input),
      );
    },
    async transition(input) {
      return db.transaction(async (tx) =>
        createDocumentsServiceForTransaction(tx).transition(input),
      );
    },
  };

  return {
    accountingReportsService,
    accountingPeriodsService,
    partiesService,
    currenciesService,
    feesService,
    fxService,
    organizationsService,
    requisitesService,
    documentsService,
  };
}
