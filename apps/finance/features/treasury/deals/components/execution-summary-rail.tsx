"use client";

import { AlertCircle, ListChecks } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import {
  deriveFinanceDealExecutionLegSummaries,
  getFinanceDealExecutionProgress,
} from "@/features/treasury/deals/lib/execution-summary";
import {
  getDealLegKindLabel,
  getDealLegStateLabel,
  getDealOperationalPositionStateLabel,
  getDealOperationalPositionStateVariant,
} from "@/features/treasury/deals/labels";

type ExecutionSummaryRailProps = {
  deal: {
    executionPlan: Array<{
      idx: number;
      kind: string;
      runtimeState: string;
    }>;
    operationalState: {
      positions: Array<{
        kind: string;
        state: string;
      }>;
    };
  };
};

export function ExecutionSummaryRail({ deal }: ExecutionSummaryRailProps) {
  const executionLegs = deriveFinanceDealExecutionLegSummaries(deal);
  const executionProgress = getFinanceDealExecutionProgress(deal);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          Контур исполнения
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Завершено
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.doneLegCount}/{executionProgress.totalLegCount}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Заблокировано
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.blockedLegCount}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Операционных вопросов
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.issueCount}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {executionLegs.map((leg) => {
            const primaryPosition =
              leg.primaryPositionKind === null
                ? null
                : deal.operationalState.positions.find(
                    (position) => position.kind === leg.primaryPositionKind,
                  ) ?? null;

            return (
              <div
                key={`${leg.idx}:${leg.kind}`}
                className="rounded-lg border p-4"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {leg.idx}. {getDealLegKindLabel(leg.kind)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getDealLegStateLabel(leg.state)}
                      </div>
                    </div>
                    <Badge variant="outline">{getDealLegStateLabel(leg.state)}</Badge>
                  </div>

                  {leg.primaryPositionLabel ? (
                    <div className="rounded-md bg-muted/30 px-3 py-2 text-sm">
                      <div className="text-muted-foreground">Ключевая позиция</div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="font-medium">{leg.primaryPositionLabel}</span>
                        {primaryPosition ? (
                          <Badge
                            variant={getDealOperationalPositionStateVariant(primaryPosition.state)}
                          >
                            {getDealOperationalPositionStateLabel(primaryPosition.state)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {leg.blocker ? (
                    <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{leg.blocker}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Явных операционных блокеров для шага сейчас нет.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
