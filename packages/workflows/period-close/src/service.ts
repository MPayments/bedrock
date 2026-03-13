import { noopLogger, type Logger } from "@bedrock/observability/logger";
import type {
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/core/worker";
import { getPreviousCalendarMonthRange } from "@bedrock/accounting-close";

function formatPeriodLabel(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
}

export interface PeriodCloseWorkerCounterpartyContext {
  counterpartyId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface CreatePeriodCloseForCounterpartyInput {
  actorUserId: string;
  counterpartyId: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

type PeriodCloseWorkerCounterpartyGuard = (
  input: PeriodCloseWorkerCounterpartyContext,
) => Promise<boolean> | boolean;

export interface PeriodCloseWorkerRunnerDeps {
  logger?: Logger;
  beforeCounterparty?: PeriodCloseWorkerCounterpartyGuard;
  resolveSystemActorUserId(): Promise<string | null>;
  listCounterpartyIds(): Promise<string[]>;
  createPeriodCloseForCounterparty(
    input: CreatePeriodCloseForCounterpartyInput,
  ): Promise<boolean>;
}

export type PeriodCloseWorkerRunner = (
  context: WorkerRunContext,
) => Promise<WorkerRunResult>;

export function createPeriodCloseWorkerRunner(
  deps: PeriodCloseWorkerRunnerDeps,
): PeriodCloseWorkerRunner {
  const log = deps.logger?.child({ svc: "documents-period-close" }) ?? noopLogger;
  const beforeCounterparty = deps.beforeCounterparty;

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

    const counterpartyIds = await deps.listCounterpartyIds();

    let processed = 0;
    let blocked = 0;

    for (const counterpartyId of counterpartyIds) {
      if (context.signal.aborted) {
        break;
      }

      if (beforeCounterparty) {
        const enabled = await beforeCounterparty({
          counterpartyId,
          periodStart,
          periodEnd,
        });
        if (!enabled) {
          blocked += 1;
          continue;
        }
      }

      const created = await deps.createPeriodCloseForCounterparty({
        actorUserId,
        counterpartyId,
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
