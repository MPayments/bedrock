"use client";

import type {
  ApiDealPricingRouteAttachment,
  ApiPaymentRouteDraft,
} from "./types";

type RoutePreviewProps = {
  currencyCodeById: Map<string, string>;
  routeAttachment: ApiDealPricingRouteAttachment | null;
};

function buildCurrencyChain(
  draft: ApiPaymentRouteDraft,
  currencyCodeById: Map<string, string>,
): string {
  if (draft.legs.length === 0) {
    return "—";
  }

  const codes: string[] = [];
  const first = draft.legs[0]!;
  codes.push(currencyCodeById.get(first.fromCurrencyId) ?? first.fromCurrencyId);

  for (const leg of draft.legs) {
    codes.push(currencyCodeById.get(leg.toCurrencyId) ?? leg.toCurrencyId);
  }

  return codes.join(" → ");
}

export function RoutePreview({
  currencyCodeById,
  routeAttachment,
}: RoutePreviewProps) {
  if (!routeAttachment) {
    return (
      <div className="rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 text-sm text-muted-foreground">
        Маршрут будет назначен автоматически
      </div>
    );
  }

  const draft = routeAttachment.snapshot;
  const chain = buildCurrencyChain(draft, currencyCodeById);
  const hops = draft.legs.length;

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{routeAttachment.templateName}</span>
        <span className="text-xs text-muted-foreground">
          {hops} {hops === 1 ? "шаг" : "шагов"}
        </span>
      </div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">
        {chain}
      </div>
      {draft.participants.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {draft.participants.map((participant) => (
            <li key={participant.nodeId}>
              <span className="text-foreground">
                {participant.displayName}
              </span>
              {participant.binding === "abstract" ? (
                <span className="ml-1">(шаблон)</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
