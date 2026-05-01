"use client";

import type { ApiDealPricingRouteAttachment } from "./types";

type RoutePreviewProps = {
  routeAttachment: ApiDealPricingRouteAttachment | null;
};

export function RoutePreview({ routeAttachment }: RoutePreviewProps) {
  if (!routeAttachment) {
    return (
      <div className="rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 text-sm text-muted-foreground">
        Маршрут будет назначен автоматически
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <span className="font-medium">{routeAttachment.templateName}</span>
    </div>
  );
}
