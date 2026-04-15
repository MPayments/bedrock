import { History } from "lucide-react";
import { isUuidLike } from "@bedrock/shared/core/uuid";

import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import {
  ATTACHMENT_PURPOSE_LABELS,
  DEAL_LEG_KIND_LABELS,
  DEAL_LEG_STATE_LABELS,
  DEAL_TIMELINE_EVENT_LABELS,
  STATUS_LABELS,
} from "./constants";
import { formatDate } from "./format";
import type { ApiCrmDealWorkbenchProjection, ApiDealTimelineEvent, ApiDealWorkflowLeg } from "./types";

function isVisibleTimelineEvent(event: ApiDealTimelineEvent) {
  return event.type !== "attachment_ingestion_failed";
}

function getTimelineActorLabel(event: ApiDealTimelineEvent) {
  const actorLabel = event.actor?.label?.trim();
  if (actorLabel) {
    return actorLabel;
  }

  const actorUserId = event.actor?.userId?.trim();
  if (!actorUserId || isUuidLike(actorUserId)) {
    return null;
  }

  return actorUserId;
}

function getPayloadString(event: ApiDealTimelineEvent, key: string) {
  const value = event.payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getPayloadNumber(event: ApiDealTimelineEvent, key: string) {
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
  event: ApiDealTimelineEvent,
  executionPlan: ApiDealWorkflowLeg[],
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

  const operationId = getPayloadString(event, "operationId");
  if (operationId) {
    return executionPlan.find((leg) =>
      leg.operationRefs.some((operationRef) => operationRef.operationId === operationId),
    );
  }

  return null;
}

function getExecutionLegLabel(
  event: ApiDealTimelineEvent,
  executionPlan: ApiDealWorkflowLeg[],
) {
  const leg = findExecutionLeg(event, executionPlan);
  if (!leg) {
    return null;
  }

  return DEAL_LEG_KIND_LABELS[leg.kind] ?? `Этап ${leg.idx}`;
}

function getTimelineTitle(
  event: ApiDealTimelineEvent,
  executionPlan: ApiDealWorkflowLeg[],
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

  return DEAL_TIMELINE_EVENT_LABELS[event.type] ?? event.type;
}

function renderTimelineDetails(event: ApiDealTimelineEvent) {
  if (event.type === "status_changed" && typeof event.payload.status === "string") {
    return STATUS_LABELS[event.payload.status as keyof typeof STATUS_LABELS];
  }

  if (event.type === "leg_state_changed") {
    const kind =
      typeof event.payload.kind === "string" ? event.payload.kind : "leg";
    const state =
      typeof event.payload.state === "string" ? event.payload.state : null;
    const legLabel =
      DEAL_LEG_KIND_LABELS[kind as keyof typeof DEAL_LEG_KIND_LABELS] ?? "Этап";
    const stateLabel = state
      ? DEAL_LEG_STATE_LABELS[state as keyof typeof DEAL_LEG_STATE_LABELS] ?? state
      : null;
    return stateLabel ? `${legLabel} -> ${stateLabel}` : legLabel;
  }

  if (
    event.type === "attachment_ingested" ||
    event.type === "attachment_ingestion_failed"
  ) {
    const purpose =
      typeof event.payload.purpose === "string"
        ? ATTACHMENT_PURPOSE_LABELS[
            event.payload.purpose as keyof typeof ATTACHMENT_PURPOSE_LABELS
          ] ?? "файл"
        : "файл";

    if (event.type === "attachment_ingested") {
      const appliedFields = Array.isArray(event.payload.appliedFields)
        ? event.payload.appliedFields.length
        : 0;
      return appliedFields > 0
        ? `${purpose} распознан, заполнено полей: ${appliedFields}`
        : `${purpose} распознан без изменений`;
    }

    if (typeof event.payload.errorMessage === "string" && event.payload.errorMessage) {
      return `${purpose}: ${event.payload.errorMessage}`;
    }

    return `${purpose}: ошибка распознавания`;
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

type DealTimelineCardProps = {
  workbench: ApiCrmDealWorkbenchProjection;
};

export function DealTimelineCard({ workbench }: DealTimelineCardProps) {
  const executionPlan = workbench.executionPlan;
  const timeline = workbench.timeline;
  const visibleTimeline = timeline.filter(isVisibleTimelineEvent);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Таймлайн
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visibleTimeline.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            По сделке еще нет событий.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTimeline.map((event) => {
              const details = renderTimelineDetails(event);
              const actorLabel = getTimelineActorLabel(event);

              return (
                <div key={event.id} className="border-l-2 pl-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-medium">
                      {getTimelineTitle(event, executionPlan)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(event.occurredAt)}
                    </div>
                  </div>
                  {(details || actorLabel) && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {[details, actorLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
