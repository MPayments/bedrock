import { History } from "lucide-react";

import type {
  FinanceDealWorkbench,
  FinanceDealWorkspace,
} from "@/features/treasury/deals/lib/queries";
import {
  getDealLegKindLabel,
  getDealLegStateLabel,
  getDealTimelineEventLabel,
  getFinanceDealStatusLabel,
} from "@/features/treasury/deals/labels";
import { formatDate } from "@/lib/format";

type FinanceDealTimelineEvent =
  | FinanceDealWorkbench["timeline"][number]
  | FinanceDealWorkspace["timeline"][number];
type FinanceDealExecutionLeg =
  | FinanceDealWorkbench["executionPlan"][number]
  | FinanceDealWorkspace["executionPlan"][number];

type DealTimelineCardProps = {
  executionPlan?: FinanceDealExecutionLeg[];
  maxItems?: number;
  timeline: FinanceDealTimelineEvent[];
};

function isVisibleTimelineEvent(event: FinanceDealTimelineEvent) {
  return event.type !== "attachment_ingestion_failed";
}

function getTimelineActorLabel(event: FinanceDealTimelineEvent) {
  const actorLabel = event.actor?.label?.trim();
  return actorLabel || null;
}

function getPayloadString(event: FinanceDealTimelineEvent, key: string) {
  const value = event.payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getPayloadNumber(event: FinanceDealTimelineEvent, key: string) {
  const value = event.payload[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function findExecutionLeg(
  event: FinanceDealTimelineEvent,
  executionPlan: FinanceDealExecutionLeg[],
) {
  const legId = getPayloadString(event, "legId");
  if (legId) {
    const matchingLeg = executionPlan.find((leg) => leg.id === legId);
    if (matchingLeg) {
      return matchingLeg;
    }
  }

  const legIdx = getPayloadNumber(event, "legIdx");
  if (legIdx !== null) {
    const matchingLeg = executionPlan.find((leg) => leg.idx === legIdx);
    if (matchingLeg) {
      return matchingLeg;
    }
  }

  return null;
}

function getExecutionLegLabel(
  event: FinanceDealTimelineEvent,
  executionPlan: FinanceDealExecutionLeg[],
) {
  const leg = findExecutionLeg(event, executionPlan);
  return leg ? getDealLegKindLabel(leg.kind) : null;
}

function getTimelineTitle(
  event: FinanceDealTimelineEvent,
  executionPlan: FinanceDealExecutionLeg[],
) {
  const legLabel = getExecutionLegLabel(event, executionPlan);

  if (event.type === "execution_requested") {
    return "Запущено исполнение сделки";
  }

  if (event.type === "leg_operation_created" && legLabel) {
    return `${legLabel}: создана казначейская операция`;
  }

  if (event.type === "instruction_prepared" && legLabel) {
    return `${legLabel}: инструкция подготовлена`;
  }

  if (event.type === "instruction_submitted" && legLabel) {
    return `${legLabel}: инструкция отправлена`;
  }

  if (event.type === "instruction_settled" && legLabel) {
    return `${legLabel}: инструкция исполнена`;
  }

  if (event.type === "instruction_failed" && legLabel) {
    return `${legLabel}: инструкция завершилась ошибкой`;
  }

  if (event.type === "instruction_retried" && legLabel) {
    return `${legLabel}: инструкция отправлена повторно`;
  }

  if (event.type === "instruction_voided" && legLabel) {
    return `${legLabel}: инструкция отменена`;
  }

  if (event.type === "return_requested" && legLabel) {
    return `${legLabel}: запрошен возврат`;
  }

  if (event.type === "instruction_returned" && legLabel) {
    return `${legLabel}: возврат исполнен`;
  }

  return getDealTimelineEventLabel(event.type);
}

function renderTimelineDetails(event: FinanceDealTimelineEvent) {
  if (event.type === "status_changed") {
    return getFinanceDealStatusLabel(getPayloadString(event, "status"));
  }

  if (event.type === "leg_state_changed") {
    return [
      getDealLegKindLabel(getPayloadString(event, "kind")),
      getDealLegStateLabel(getPayloadString(event, "state")),
    ].join(" -> ");
  }

  const details: string[] = [];

  if (event.type === "execution_requested") {
    const operationCount = getPayloadNumber(event, "operationCount");
    if (operationCount !== null) {
      details.push(`Подготовлено операций: ${operationCount}`);
    }
  }

  if (
    event.type === "instruction_prepared" ||
    event.type === "instruction_submitted" ||
    event.type === "instruction_settled" ||
    event.type === "instruction_failed" ||
    event.type === "instruction_retried" ||
    event.type === "instruction_voided" ||
    event.type === "return_requested" ||
    event.type === "instruction_returned"
  ) {
    const attempt = getPayloadNumber(event, "attempt");
    if (attempt !== null && attempt > 1) {
      details.push(`Попытка ${attempt}`);
    }
  }

  const comment = getPayloadString(event, "comment");
  if (comment) {
    details.push(comment);
  }

  return details.length > 0 ? details.join(" · ") : null;
}

export function DealTimelineCard({
  executionPlan = [],
  maxItems,
  timeline,
}: DealTimelineCardProps) {
  const visibleTimeline = timeline.filter(isVisibleTimelineEvent);
  const limitedTimeline =
    typeof maxItems === "number" ? visibleTimeline.slice(0, maxItems) : visibleTimeline;

  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center gap-2 border-b p-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <div className="text-sm font-semibold">Таймлайн</div>
      </header>
      <div className="p-3">
        {limitedTimeline.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            По сделке еще нет событий.
          </div>
        ) : (
          <div className="space-y-3">
            {limitedTimeline.map((event) => {
              const actorLabel = getTimelineActorLabel(event);
              const details = renderTimelineDetails(event);

              return (
                <div key={event.id} className="border-l-2 pl-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-medium">
                      {getTimelineTitle(event, executionPlan)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(event.occurredAt)}
                    </div>
                  </div>
                  {(details || actorLabel) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[details, actorLabel].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
