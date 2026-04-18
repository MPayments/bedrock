import { asc, eq } from "drizzle-orm";

import type { AccountingModule } from "@bedrock/accounting";
import {
  createAccountingPeriodDocumentTransitionEffectsService,
  createDocumentsService,
  createRuleBasedDocumentActionPolicyService,
  type DocumentApprovalRule,
} from "@bedrock/documents";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import { user } from "@bedrock/iam/schema";
import { createIdempotencyService } from "@bedrock/platform/idempotency-postgres";
import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import {
  bindPersistenceSession,
  createPersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";
import type { Database } from "@bedrock/platform/persistence/drizzle";
import type { BedrockWorker } from "@bedrock/platform/worker-runtime";
import { createPeriodCloseDocumentModule } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import {
  createPeriodCloseWorkflow,
  createPeriodCloseWorkerRunner,
  type PeriodCloseWorkerOrganizationContext,
} from "@bedrock/workflow-period-close";

import { createWorkerAccountingModule } from "../accounting-module";
import { createWorkerLedgerModule } from "../ledger-module";
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
  const idempotency = createIdempotencyService({ logger: deps.logger });
  const accountingLogger = deps.logger ?? noopLogger;
  const ledgerModule = createWorkerLedgerModule({
    db: deps.db,
    idempotency,
    logger: accountingLogger,
  });
  const ledgerReadPort = {
    getOperationDetails: ledgerModule.operations.queries.getDetails,
    listOperationDetails: ledgerModule.operations.queries.listDetails,
  };
  const accountingModule = createWorkerAccountingModule({
    db: deps.db,
    persistence: createPersistenceContext(deps.db),
    logger: accountingLogger,
  });
  const accountingPeriods = {
    async assertOrganizationPeriodsOpen(input: {
      occurredAt: Date;
      organizationIds: string[];
      docType: string;
    }) {
      return accountingModule.periods.commands.assertOrganizationPeriodsOpen(
        input,
      );
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
        ? createWorkerAccountingModule({
            db: target,
            persistence: bindPersistenceSession(target),
            logger: accountingLogger,
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
        ? createWorkerAccountingModule({
            db: target,
            persistence: bindPersistenceSession(target),
            logger: accountingLogger,
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
  const documentsAccountingPort = {
    getDefaultCompiledPack:
      accountingModule.packs.queries.getDefaultCompiledPack,
    loadActiveCompiledPackForBook:
      accountingModule.packs.queries.loadActivePackForBook,
    resolvePostingPlan: accountingModule.packs.queries.resolvePostingPlan,
  };
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
  const createDocumentsServiceForTransaction = (tx: Transaction) =>
    createDocumentsService({
      persistence: bindPersistenceSession(tx),
      idempotency,
      accounting: documentsAccountingPort,
      accountingPeriods,
      ledgerReadService: ledgerReadPort,
      policy: documentsPolicy,
      registry: documentRegistry,
      transitionEffects: documentTransitionEffects,
      logger: deps.logger,
    });
  const documentsService = createDocumentsService({
    persistence: createPersistenceContext(deps.db),
    idempotency,
    accounting: documentsAccountingPort,
    accountingPeriods,
    ledgerReadService: ledgerReadPort,
    policy: documentsPolicy,
    registry: documentRegistry,
    transitionEffects: documentTransitionEffects,
    logger: deps.logger,
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
      createDraft: (input) =>
        deps.db.transaction((tx) =>
          createDocumentsServiceForTransaction(tx).createDraft(input),
        ),
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
