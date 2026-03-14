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
import { createDocumentsService } from "@bedrock/documents";
import { createDocumentsQueries } from "@bedrock/documents/queries";
import { createLedgerEngine, createLedgerReadService } from "@bedrock/ledger";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import { assertBooksBelongToInternalLedgerOrganizations } from "@bedrock/organizations";
import { listInternalLedgerOrganizations } from "@bedrock/organizations";
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
  const rows = await listInternalLedgerOrganizations(db);
  return rows.map((row) => row.id);
}

async function createPeriodCloseForOrganization(input: {
  documentsQueries: ReturnType<typeof createDocumentsQueries>;
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
    await input.documentsQueries.findDocumentIdByCreateIdempotencyKey({
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
  const ledgerQueries = createLedgerQueries({ db: queryable });
  const organizationsQueries = createOrganizationsQueries({ db: queryable });
  const reportsRepository = createDrizzleAccountingReportsRepository(queryable);
  const reportContext = createAccountingReportsContext({
    balancesQueries,
    counterpartiesQueries,
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
        documentsQueries: createDocumentsQueries({ db: queryable }),
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
  const packsService = createAccountingPacksService({
    defaultPackDefinition: rawPackDefinition,
    cache: createInMemoryAccountingCompiledPackCache(),
    repository: createDrizzleAccountingPacksRepository(db),
    withTransaction: async (run) =>
      db.transaction(async (tx) =>
        run(createDrizzleAccountingPacksRepository(tx)),
      ),
    assertBooksBelongToInternalLedgerOrganizations: (bookIds) =>
      assertBooksBelongToInternalLedgerOrganizations({ db, bookIds }),
  });

  return createAccountingService({
    repository: createDrizzleAccountingChartRepository(db),
    packsService,
  });
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
  const documentsQueries = createDocumentsQueries({ db: deps.db });
  const accountingPeriods = createAccountingPeriodsPort(deps.db);
  const documentsService = createDocumentsService({
    accounting: createPeriodCloseAccountingService(deps.db),
    accountingPeriods,
    db: deps.db,
    idempotency: createIdempotencyService({ logger: deps.logger }),
    ledger: createLedgerEngine({
      db: deps.db,
      assertInternalLedgerBooks: assertBooksBelongToInternalLedgerOrganizations,
    }),
    ledgerReadService: createLedgerReadService({ db: deps.db }),
    registry: createDocumentRegistry([createPeriodCloseDocumentModule()]),
    logger: deps.logger,
  });
  const runOnce = createPeriodCloseWorkerRunner({
    logger: deps.logger,
    beforeOrganization: deps.beforeOrganization,
    resolveSystemActorUserId: () => resolveSystemActorUserId(deps.db),
    listOrganizationIds: () => listOrganizationIds(deps.db),
    createPeriodCloseForOrganization: (input) =>
      createPeriodCloseForOrganization({
        documentsQueries,
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
