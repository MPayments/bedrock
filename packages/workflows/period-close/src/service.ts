import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type {
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";
import { getPreviousCalendarMonthRange } from "@bedrock/accounting/periods";

function formatPeriodLabel(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
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
