import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import {
  KEY_DATE_LABELS,
  KEY_DATE_ORDER,
  findFirstEventOfType,
  formatKeyDate,
} from "@/lib/timeline-labels";

import type { ApiDealTimelineEvent } from "./types";

type KeyDatesSidebarCardProps = {
  timeline: ApiDealTimelineEvent[];
};

export function KeyDatesSidebarCard({ timeline }: KeyDatesSidebarCardProps) {
  const entries = KEY_DATE_ORDER.map((type) => {
    const event = findFirstEventOfType(timeline, type);
    return {
      label: KEY_DATE_LABELS[type] ?? type.toUpperCase(),
      value: formatKeyDate(event?.occurredAt ?? null),
    };
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Key dates</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-2 text-[12.5px]">
        {entries.map((entry) => (
          <div
            key={entry.label}
            className="flex items-center justify-between gap-3"
          >
            <span className="kv-label !m-0">{entry.label}</span>
            <span className="font-mono text-[12px] text-foreground">
              {entry.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
