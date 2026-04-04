import { History } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import type {
  FinanceDealWorkbench,
  FinanceDealWorkspace,
} from "@/features/treasury/deals/lib/queries";
import { getDealTimelineEventLabel } from "@/features/treasury/deals/labels";
import { formatDate } from "@/lib/format";

type FinanceDealTimelineEvent =
  | FinanceDealWorkbench["timeline"][number]
  | FinanceDealWorkspace["timeline"][number];

type DealTimelineCardProps = {
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

export function DealTimelineCard({
  maxItems,
  timeline,
}: DealTimelineCardProps) {
  const visibleTimeline = timeline.filter(isVisibleTimelineEvent);
  const limitedTimeline =
    typeof maxItems === "number" ? visibleTimeline.slice(0, maxItems) : visibleTimeline;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Таймлайн
        </CardTitle>
      </CardHeader>
      <CardContent>
        {limitedTimeline.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            По сделке еще нет событий.
          </div>
        ) : (
          <div className="space-y-4">
            {limitedTimeline.map((event) => {
              const actorLabel = getTimelineActorLabel(event);

              return (
                <div key={event.id} className="border-l-2 pl-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-medium">
                      {getDealTimelineEventLabel(event.type)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(event.occurredAt)}
                    </div>
                  </div>
                  {actorLabel && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {actorLabel}
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
