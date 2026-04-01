import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { DEAL_TIMELINE_EVENT_LABELS, STATUS_LABELS } from "./constants";
import { formatDate } from "./format";
import type { ApiDealTimelineEvent } from "./types";

function renderTimelineDetails(event: ApiDealTimelineEvent) {
  if (event.type === "status_changed" && typeof event.payload.status === "string") {
    return STATUS_LABELS[event.payload.status as keyof typeof STATUS_LABELS];
  }

  if (event.type === "leg_state_changed") {
    const kind =
      typeof event.payload.kind === "string" ? event.payload.kind : "leg";
    const state =
      typeof event.payload.state === "string" ? event.payload.state : null;
    return state ? `${kind} -> ${state}` : kind;
  }

  if (typeof event.payload.quoteId === "string") {
    return event.payload.quoteId;
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Таймлайн
        </CardTitle>
      </CardHeader>
      <CardContent>
        {timeline.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            По сделке еще нет событий.
          </div>
        ) : (
          <div className="space-y-4">
            {timeline.map((event) => {
              const details = renderTimelineDetails(event);

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
                  {(details || event.actor?.label || event.actor?.userId) && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {[details, event.actor?.label, event.actor?.userId]
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
