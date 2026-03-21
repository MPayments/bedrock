import { asc, eq } from "drizzle-orm";

import {
  createAccountingService,
  createAccountingChartService,
  createAccountingPacksService,
  createAccountingClosePackageSnapshotPort,
  createAccountingPeriodsService,
  createAccountingReportQueries,
  createAccountingReportsContext,
  createInMemoryAccountingCompiledPackCache,
  createDrizzleAccountingPeriodsCommandRepository,
  createDrizzleAccountingPeriodsQueryRepository,
  createDrizzleAccountingReportsRepository,
  type AccountingPeriodsService,
} from "@bedrock/accounting";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import { createBalancesQueries } from "@bedrock/balances/queries";
import {
  createAccountingPeriodDocumentTransitionEffectsService,
  createDocumentsService,
  createRuleBasedDocumentActionPolicyService,
  type DocumentApprovalRule,
} from "@bedrock/documents";
import {
  createDrizzleDocumentsReadModel,
} from "@bedrock/documents/read-model";
import { createLedgerReadService } from "@bedrock/ledger";
import { createLedgerQueries } from "@bedrock/ledger/queries";
import { user } from "@bedrock/platform/auth-model/schema";
import { createIdempotencyService } from "@bedrock/platform/idempotency-postgres";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  bindPersistenceSession,
  createPersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";
import type { Database } from "@bedrock/platform/persistence/drizzle";
import type { BedrockWorker } from "@bedrock/platform/worker-runtime";
import { createPeriodCloseDocumentModule } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import { createDocumentDraftWorkflow } from "@bedrock/workflow-document-drafts";
import {
  createPeriodCloseWorkflow,
  createPeriodCloseWorkerRunner,
  type PeriodCloseWorkerOrganizationContext,
} from "@bedrock/workflow-period-close";

import { createWorkerPartiesReadRuntime } from "../parties-module";

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

async function isAdminActor(
  db: Database,
  actorUserId: string,
): Promise<boolean> {
  const [actor] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, actorUserId))
    .limit(1);

  return actor?.role === "admin";
}

async function listOrganizationIds(db: Database): Promise<string[]> {
  const { organizationsQueries } = createWorkerPartiesReadRuntime(db);
  const rows = await organizationsQueries.listInternalLedgerOrganizations();
  return rows.map((row) => row.id);
}

function createAccountingReportRuntime(database: Database | Transaction) {
  const balancesQueries = createBalancesQueries({ db: database });
  const partiesReadRuntime = createWorkerPartiesReadRuntime(database);
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: database });
  const ledgerQueries = createLedgerQueries({ db: database });
  const { organizationsQueries } = partiesReadRuntime;
  const reportsRepository = createDrizzleAccountingReportsRepository(database);
  const reportContext = createAccountingReportsContext({
    balancesQueries,
    counterpartiesQueries: partiesReadRuntime.counterpartiesQueries,
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
      return db.transaction((tx) => execute(tx));
    }

    return execute(db);
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

function createPeriodCloseAccountingService(db: Database) {
  const { organizationsQueries } = createWorkerPartiesReadRuntime(db);
  const packsService = createAccountingPacksService({
    db,
    defaultPackDefinition: rawPackDefinition,
    cache: createInMemoryAccountingCompiledPackCache(),
    assertBooksBelongToInternalLedgerOrganizations:
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations,
  });

  return createAccountingService({
    chart: createAccountingChartService({ db }),
    packs: packsService,
  });
}

const PERIOD_CLOSE_APPROVAL_RULES: DocumentApprovalRule[] = [
  {
    docTypes: ["period_close", "period_reopen"],
    approvalMode: "maker_checker",
  },
];

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
  const accountingService = createPeriodCloseAccountingService(deps.db);
  const ledgerReadService = createLedgerReadService({ db: deps.db });
  const documentRegistry = createDocumentRegistry([
    createPeriodCloseDocumentModule(),
  ]);
  const documentsPolicy = createRuleBasedDocumentActionPolicyService({
    rules: PERIOD_CLOSE_APPROVAL_RULES,
    isActorExemptFromApproval: ({ actorUserId }) =>
      isAdminActor(deps.db, actorUserId),
  });
  const documentTransitionEffects =
    createAccountingPeriodDocumentTransitionEffectsService();
  const documentsService = createDocumentsService({
    persistence: createPersistenceContext(deps.db),
    idempotency,
    accounting: accountingService.packs,
    accountingPeriods,
    ledgerReadService,
    policy: documentsPolicy,
    registry: documentRegistry,
    transitionEffects: documentTransitionEffects,
    logger: deps.logger,
  });
  const documentDraftWorkflow = createDocumentDraftWorkflow({
    db: deps.db,
    createDocumentsService: (tx) =>
      createDocumentsService({
        persistence: bindPersistenceSession(tx),
        idempotency,
        accounting: accountingService.packs,
        accountingPeriods,
        ledgerReadService,
        policy: documentsPolicy,
        registry: documentRegistry,
        transitionEffects: documentTransitionEffects,
        logger: deps.logger,
      }),
  });
  const periodCloseWorkflow = createPeriodCloseWorkflow({
    documents: {
      async listPeriodCloseDocuments(input) {
        const documents =
          await documentsReadModel.listAdjustmentsForOrganizationPeriod({
            organizationId: input.organizationId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            docTypes: ["period_close"],
          });

        const loaded = await Promise.all(
          documents.map((document) =>
            documentsReadModel.getDocumentByType({
              documentId: document.documentId,
              docType: document.docType,
            }),
          ),
        );

        return loaded.filter((document) => document !== null);
      },
      createDraft: documentDraftWorkflow.createDraft,
      submit: ({ actorUserId, docType, documentId, idempotencyKey }) =>
        documentsService.actions.execute({
          action: "submit",
          actorUserId,
          docType,
          documentId,
          idempotencyKey,
        }),
    },
  });
  const runOnce = createPeriodCloseWorkerRunner({
    logger: deps.logger,
    beforeOrganization: deps.beforeOrganization,
    resolveSystemActorUserId: () => resolveSystemActorUserId(deps.db),
    listOrganizationIds: () => listOrganizationIds(deps.db),
    createPeriodCloseForOrganization:
      periodCloseWorkflow.createPeriodCloseForOrganization,
  });

  return {
    id: deps.id,
    intervalMs: deps.intervalMs,
    runOnce,
  };
}
