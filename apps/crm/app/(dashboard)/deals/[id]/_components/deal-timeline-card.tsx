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
import type { ApiDealTimelineEvent } from "./types";

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

  if (typeof event.payload.comment === "string" && event.payload.comment.trim()) {
    return event.payload.comment;
  }

  return null;
}

type DealTimelineCardProps = {
  timeline: ApiDealTimelineEvent[];
};

export function DealTimelineCard({ timeline }: DealTimelineCardProps) {
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
                      {DEAL_TIMELINE_EVENT_LABELS[event.type] ?? event.type}
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
