import { asc, eq } from "drizzle-orm";

import {
  createAccountingService,
  createDrizzleAccountingChartRepository,
} from "@bedrock/accounting";
import {
  createAccountingPacksService,
  createDrizzleAccountingPacksRepository,
  createInMemoryAccountingCompiledPackCache,
} from "@bedrock/accounting/packs";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import {
  createAccountingClosePackageSnapshotPort,
  createAccountingPeriodsService,
  createDrizzleAccountingPeriodsRepository,
  type AccountingPeriodsService,
} from "@bedrock/accounting/periods";
import {
  createAccountingReportQueries,
  createAccountingReportsContext,
  createDrizzleAccountingReportsRepository,
} from "@bedrock/accounting/reports";
import { createBalancesQueries } from "@bedrock/balances/queries";
import { createCounterpartiesQueries } from "@bedrock/counterparties/queries";
import {
  createDocumentsService,
  type DocumentsIdempotencyPort,
  type DocumentsTransactionsPort,
} from "@bedrock/documents";
import type { DocumentModuleRuntime } from "@bedrock/documents/plugins";
import {
  createDrizzleDocumentsReadModel,
  type DocumentsReadModel,
} from "@bedrock/documents/read-model";
import { createDrizzleDocumentsRepository } from "@bedrock/documents/repository";
import { createLedgerReadService, createLedgerService } from "@bedrock/ledger";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
import { user } from "@bedrock/platform/auth-model/schema";
import { createIdempotencyService } from "@bedrock/platform/idempotency-postgres";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { Transaction } from "@bedrock/platform/persistence";
import type { Database } from "@bedrock/platform/persistence/drizzle";
import type { BedrockWorker } from "@bedrock/platform/worker-runtime";
import { createPeriodCloseDocumentModule } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import {
  createPeriodCloseWorkerRunner,
  type PeriodCloseWorkerOrganizationContext,
} from "@bedrock/workflow-period-close";

type Queryable = Database | Transaction;

function createDocumentsModuleRuntime(queryable: Queryable): DocumentModuleRuntime {
  return {
    documents: createDrizzleDocumentsReadModel({ db: queryable }),
    withQueryable: (run) => run(queryable),
  };
}

function buildPeriodCloseIdempotencyKey(organizationId: string, periodStart: Date) {
  return `period_close:${organizationId}:${periodStart.toISOString().slice(0, 7)}`;
}

async function resolveSystemActorUserId(db: Database): Promise<string | null> {
  const [admin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .orderBy(asc(user.createdAt))
    .limit(1);

  if (admin) {
    return admin.id;
  }

  const [fallback] = await db
    .select({ id: user.id })
    .from(user)
    .orderBy(asc(user.createdAt))
    .limit(1);

  return fallback?.id ?? null;
}

async function listOrganizationIds(db: Database): Promise<string[]> {
  const organizationsQueries = createOrganizationsQueries({ db });
  const rows = await organizationsQueries.listInternalLedgerOrganizations();
  return rows.map((row) => row.id);
}

async function createPeriodCloseForOrganization(input: {
  documentsReadModel: DocumentsReadModel;
  documentsService: ReturnType<typeof createDocumentsService>;
  actorUserId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}): Promise<boolean> {
  const createIdempotencyKey = buildPeriodCloseIdempotencyKey(
    input.organizationId,
    input.periodStart,
  );
  const existingDocumentId =
    await input.documentsReadModel.findDocumentIdByCreateIdempotencyKey({
      docType: "period_close",
      createIdempotencyKey,
    });

  if (existingDocumentId) {
    return false;
  }

  const draft = await input.documentsService.createDraft({
    docType: "period_close",
    createIdempotencyKey,
    actorUserId: input.actorUserId,
    payload: {
      organizationId: input.organizationId,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
      occurredAt: input.periodEnd.toISOString(),
      closeReason: "auto_monthly_close",
    },
  });

  if (draft.document.submissionStatus === "draft") {
    await input.documentsService.transition({
      action: "submit",
      docType: draft.document.docType,
      documentId: draft.document.id,
      actorUserId: input.actorUserId,
      idempotencyKey: `${createIdempotencyKey}:submit`,
    });
  }

  return true;
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
    ledgerQueries,
    organizationsQueries,
    reportQueries: createAccountingReportQueries({
      context: reportContext,
    }),
  };
}

function createAccountingPeriodsPort(db: Database): AccountingPeriodsService {
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
      return db.transaction((tx) => execute(tx));
    }

    return execute(db);
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

function createPeriodCloseAccountingService(db: Database) {
  const organizationsQueries = createOrganizationsQueries({ db });
  const packsService = createAccountingPacksService({
    defaultPackDefinition: rawPackDefinition,
    cache: createInMemoryAccountingCompiledPackCache(),
    repository: createDrizzleAccountingPacksRepository(db),
    withTransaction: async (run) =>
      db.transaction(async (tx) =>
        run(createDrizzleAccountingPacksRepository(tx)),
      ),
    assertBooksBelongToInternalLedgerOrganizations:
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations,
  });

  return createAccountingService({
    repository: createDrizzleAccountingChartRepository(db),
    packsService,
  });
}

function createDocumentsTransactions(input: {
  database: Database;
  idempotency: ReturnType<typeof createIdempotencyService>;
  ledger: ReturnType<typeof createLedgerService>;
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

export function createPeriodCloseWorkerDefinition(deps: {
  id: string;
  intervalMs: number;
  db: Database;
  logger?: Logger;
  beforeOrganization?: (
    input: PeriodCloseWorkerOrganizationContext,
  ) => Promise<boolean> | boolean;
}): BedrockWorker {
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: deps.db });
  const accountingPeriods = createAccountingPeriodsPort(deps.db);
  const idempotency = createIdempotencyService({ logger: deps.logger });
  const organizationsQueries = createOrganizationsQueries({ db: deps.db });
  const ledger = createLedgerService({
    db: deps.db,
    assertInternalLedgerBooks: async ({ bookIds }) =>
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations(
        bookIds,
      ),
  });
  const documentsService = createDocumentsService({
    accounting: createPeriodCloseAccountingService(deps.db),
    accountingPeriods,
    ledgerReadService: createLedgerReadService({ db: deps.db }),
    moduleRuntime: createDocumentsModuleRuntime(deps.db),
    repository: createDrizzleDocumentsRepository(deps.db),
    registry: createDocumentRegistry([createPeriodCloseDocumentModule()]),
    transactions: createDocumentsTransactions({
      database: deps.db,
      idempotency,
      ledger,
    }),
    logger: deps.logger,
  });
  const runOnce = createPeriodCloseWorkerRunner({
    logger: deps.logger,
    beforeOrganization: deps.beforeOrganization,
    resolveSystemActorUserId: () => resolveSystemActorUserId(deps.db),
    listOrganizationIds: () => listOrganizationIds(deps.db),
    createPeriodCloseForOrganization: (input) =>
      createPeriodCloseForOrganization({
        documentsReadModel,
        documentsService,
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        periodLabel: input.periodLabel,
      }),
  });

  return {
    id: deps.id,
    intervalMs: deps.intervalMs,
    runOnce,
  };
}
