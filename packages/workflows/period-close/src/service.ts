import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type {
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

function formatPeriodLabel(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
}

function getPreviousCalendarMonthRange(now: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
  );

  return {
    periodStart: previousMonthStart,
    periodEnd: currentMonthStart,
  };
}

export interface PeriodCloseWorkerOrganizationContext {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface CreatePeriodCloseForOrganizationInput {
  actorUserId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

export interface PeriodCloseDraftResult {
  document: {
    id: string;
    docType: string;
    submissionStatus: string;
  };
}

export interface PeriodCloseDocumentState {
  id: string;
  docType: string;
  createIdempotencyKey: string | null;
  submissionStatus: "draft" | "submitted";
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  lifecycleStatus: "active" | "cancelled";
}

export interface PeriodCloseDocumentsPort {
  listPeriodCloseDocuments(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<PeriodCloseDocumentState[]>;
  createDraft(input: {
    docType: string;
    createIdempotencyKey: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }): Promise<PeriodCloseDraftResult>;
  submit(input: {
    docType: string;
    documentId: string;
    actorUserId: string;
    idempotencyKey: string;
  }): Promise<unknown>;
}

export interface PeriodCloseWorkflowDeps {
  documents: PeriodCloseDocumentsPort;
}

type PeriodCloseWorkerOrganizationGuard = (
  input: PeriodCloseWorkerOrganizationContext,
) => Promise<boolean> | boolean;

export interface PeriodCloseWorkerRunnerDeps {
  logger?: Logger;
  beforeOrganization?: PeriodCloseWorkerOrganizationGuard;
  resolveSystemActorUserId(): Promise<string | null>;
  listOrganizationIds(): Promise<string[]>;
  createPeriodCloseForOrganization(
    input: CreatePeriodCloseForOrganizationInput,
  ): Promise<boolean>;
}

export type PeriodCloseWorkerRunner = (
  context: WorkerRunContext,
) => Promise<WorkerRunResult>;

function buildPeriodCloseIdempotencyKey(
  organizationId: string,
  periodStart: Date,
) {
  return `period_close:${organizationId}:${periodStart.toISOString().slice(0, 7)}`;
}

function buildPeriodCloseCreateIdempotencyKey(input: {
  organizationId: string;
  periodStart: Date;
  attempt: number;
}) {
  const baseKey = buildPeriodCloseIdempotencyKey(
    input.organizationId,
    input.periodStart,
  );

  return input.attempt <= 1 ? baseKey : `${baseKey}:retry:${input.attempt}`;
}

export function createPeriodCloseWorkflow(deps: PeriodCloseWorkflowDeps) {
  return {
    async createPeriodCloseForOrganization(
      input: CreatePeriodCloseForOrganizationInput,
    ): Promise<boolean> {
      const baseCreateIdempotencyKey = buildPeriodCloseIdempotencyKey(
        input.organizationId,
        input.periodStart,
      );
      const existingDocuments = await deps.documents.listPeriodCloseDocuments({
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      });
      const activeBlockingDocument = existingDocuments.find(
        (document) =>
          document.lifecycleStatus === "active" &&
          document.submissionStatus === "submitted" &&
          (document.approvalStatus === "approved" ||
            document.approvalStatus === "pending" ||
            document.approvalStatus === "not_required"),
      );

      if (activeBlockingDocument) {
        return false;
      }

      const activeDraft = existingDocuments.find(
        (document) =>
          document.lifecycleStatus === "active" &&
          document.submissionStatus === "draft",
      );

      if (activeDraft) {
        await deps.documents.submit({
          docType: activeDraft.docType,
          documentId: activeDraft.id,
          actorUserId: input.actorUserId,
          idempotencyKey: `${
            activeDraft.createIdempotencyKey ?? baseCreateIdempotencyKey
          }:submit`,
        });

        return true;
      }

      const createIdempotencyKey = buildPeriodCloseCreateIdempotencyKey({
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        attempt: existingDocuments.length + 1,
      });

      const draft = await deps.documents.createDraft({
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
        await deps.documents.submit({
          docType: draft.document.docType,
          documentId: draft.document.id,
          actorUserId: input.actorUserId,
          idempotencyKey: `${createIdempotencyKey}:submit`,
        });
      }

      return true;
    },
  };
}

export type PeriodCloseWorkflow = ReturnType<typeof createPeriodCloseWorkflow>;

export function createPeriodCloseWorkerRunner(
  deps: PeriodCloseWorkerRunnerDeps,
): PeriodCloseWorkerRunner {
  const log = deps.logger?.child({ svc: "documents-period-close" }) ?? noopLogger;
  const beforeOrganization = deps.beforeOrganization;

  return async function runOnce(
    context: WorkerRunContext,
  ): Promise<WorkerRunResult> {
    const { periodStart, periodEnd } = getPreviousCalendarMonthRange(context.now);
    const periodLabel = formatPeriodLabel(periodStart);
    const actorUserId = await deps.resolveSystemActorUserId();

    if (!actorUserId) {
      log.warn("period close worker skipped: no user records available");
      return { processed: 0, blocked: 0 };
    }

    const organizationIds = await deps.listOrganizationIds();

    let processed = 0;
    let blocked = 0;

    for (const organizationId of organizationIds) {
      if (context.signal.aborted) {
        break;
      }

      if (beforeOrganization) {
        const enabled = await beforeOrganization({
          organizationId,
          periodStart,
          periodEnd,
        });
        if (!enabled) {
          blocked += 1;
          continue;
        }
      }

      const created = await deps.createPeriodCloseForOrganization({
        actorUserId,
        organizationId,
        periodStart,
        periodEnd,
        periodLabel,
      });

      if (created) {
        processed += 1;
      } else {
        blocked += 1;
      }
    }

    return {
      processed,
      blocked,
    };
  };
}
