"use client";

import { cn } from "@bedrock/sdk-ui/lib/utils";
import { Badge } from "@bedrock/sdk-ui/components/badge";

import {
  getDealLegKindLabel,
  getDealLegStateLabel,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";

import { getLegKindIcon } from "./leg-icon";

type Leg = FinanceDealWorkbench["executionPlan"][number];
type TimelineFilter = "all" | "pending";

function isPendingLeg(leg: Leg) {
  return (
    leg.runtimeState === "not_materialized" ||
    leg.runtimeState === "ready" ||
    leg.runtimeState === "processing" ||
    leg.runtimeState === "blocked"
  );
}

function getLegDotClasses(state: Leg["runtimeState"]) {
  switch (state) {
    case "completed":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "not_materialized":
    case "processing":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "ready":
      return "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300";
    case "blocked":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
    case "skipped":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getLegStateBadgeVariant(
  state: Leg["runtimeState"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "completed":
      return "default";
    case "blocked":
      return "destructive";
    case "processing":
    case "ready":
      return "secondary";
    default:
      return "outline";
  }
}

export interface ExecutionTimelinePaneProps {
  legs: Leg[];
  selectedLegIdx: number | null;
  onSelectLeg: (legIdx: number) => void;
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
}

export function ExecutionTimelinePane({
  legs,
  selectedLegIdx,
  onSelectLeg,
  filter,
  onFilterChange,
}: ExecutionTimelinePaneProps) {
  const pendingCount = legs.filter(isPendingLeg).length;
  const visibleLegs = filter === "pending" ? legs.filter(isPendingLeg) : legs;

  return (
    <aside className="bg-card rounded-lg border">
      <div className="flex items-center justify-between gap-3 border-b p-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Шаги</div>
          <Badge variant="outline" className="font-mono">
            {legs.length}
          </Badge>
        </div>
        <div className="flex overflow-hidden rounded-md border text-xs">
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 transition-colors",
              filter === "all"
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => onFilterChange("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 border-l transition-colors",
              filter === "pending"
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-muted/50",
            )}
            onClick={() => onFilterChange("pending")}
          >
            Активные{pendingCount > 0 ? ` · ${pendingCount}` : ""}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-2">
        {visibleLegs.length === 0 ? (
          <div className="text-muted-foreground p-4 text-center text-sm">
            {filter === "pending"
              ? "Активных шагов нет."
              : "Шагов исполнения ещё нет."}
          </div>
        ) : (
          visibleLegs.map((leg) => {
            const selected = selectedLegIdx === leg.idx;
            const KindIcon = getLegKindIcon(leg.kind);
            return (
              <button
                key={leg.id ?? `${leg.idx}:${leg.kind}`}
                type="button"
                data-testid={`finance-deal-leg-${leg.idx}`}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-md border border-transparent p-2.5 text-left transition-colors",
                  selected
                    ? "border-border bg-muted/70 ring-ring/20 ring-1"
                    : "hover:bg-muted/40",
                )}
                onClick={() => onSelectLeg(leg.idx)}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    getLegDotClasses(leg.runtimeState),
                  )}
                  title={`Шаг ${leg.idx}`}
                >
                  <KindIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">
                      {getDealLegKindLabel(leg.kind)}
                    </div>
                    <Badge
                      data-testid={`finance-deal-leg-state-${leg.idx}`}
                      variant={getLegStateBadgeVariant(leg.runtimeState)}
                    >
                      {getDealLegStateLabel(leg.runtimeState)}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {leg.runtimeState === "not_materialized"
                      ? "Не материализован"
                      : "Связан с платёжным шагом"}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
