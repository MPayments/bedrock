import { asc, eq } from "drizzle-orm";

import { createAccountingService } from "@bedrock/accounting";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import { createAccountingPeriodsService } from "@bedrock/accounting/periods";
import { createDocumentsService } from "@bedrock/documents";
import { createDocumentsQueries } from "@bedrock/documents/queries";
import type { BedrockWorker } from "@bedrock/platform/worker-runtime";
import { user } from "@bedrock/platform/auth-model/schema";
import { createIdempotencyService } from "@bedrock/platform/idempotency-postgres";
import type { Logger } from "@bedrock/platform/observability/logger";
import { assertBooksBelongToInternalLedgerOrganizations } from "@bedrock/organizations";
import { createLedgerEngine, createLedgerReadService } from "@bedrock/ledger";
import { listInternalLedgerOrganizations } from "@bedrock/organizations";
import { createPeriodCloseDocumentModule } from "@bedrock/plugin-documents-ifrs";
import { createDocumentRegistry } from "@bedrock/plugin-documents-sdk";
import type { Database } from "@bedrock/platform/persistence/drizzle";
import {
  createPeriodCloseWorkerRunner,
  type PeriodCloseWorkerOrganizationContext,
} from "@bedrock/workflow-period-close";

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
  const accountingPeriods = createAccountingPeriodsService({
    db: deps.db,
    documentsQueriesFactory: ({ db }) => createDocumentsQueries({ db }),
  });
  const documentsService = createDocumentsService({
    accounting: createAccountingService({
      db: deps.db,
      defaultPackDefinition: rawPackDefinition,
      logger: deps.logger,
    }),
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
