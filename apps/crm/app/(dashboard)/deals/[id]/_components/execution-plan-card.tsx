import { ChevronDown, ListChecks, Workflow } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";

import {
  DEAL_LEG_KIND_LABELS,
  DEAL_LEG_STATE_COLORS,
  DEAL_LEG_STATE_LABELS,
  DEAL_SECTION_LABELS,
  STATUS_LABELS,
} from "./constants";
import type {
  ApiDealSectionCompleteness,
  ApiDealTransitionReadiness,
  ApiDealWorkflowLeg,
  DealLegState,
  DealStatus,
} from "./types";

const LEG_STATE_TRANSITIONS: Record<DealLegState, DealLegState[]> = {
  blocked: ["ready", "skipped"],
  done: [],
  in_progress: ["done", "blocked"],
  pending: ["ready", "blocked", "skipped"],
  ready: ["in_progress", "blocked", "skipped"],
  skipped: [],
};

type ExecutionPlanCardProps = {
  executionPlan: ApiDealWorkflowLeg[];
  isUpdatingLegKey: string | null;
  onBlockedTransitionClick: (status: DealStatus) => void;
  onUpdateLegState: (idx: number, state: DealLegState) => void;
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function ExecutionPlanCard({
  executionPlan,
  isUpdatingLegKey,
  onBlockedTransitionClick,
  onUpdateLegState,
  sectionCompleteness,
  transitionReadiness,
}: ExecutionPlanCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-muted-foreground" />
          Исполнение и готовность
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            Полнота секций
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sectionCompleteness.map((section) => (
              <div key={section.sectionId} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {DEAL_SECTION_LABELS[section.sectionId] ?? section.sectionId}
                  </div>
                  <Badge variant={section.complete ? "default" : "secondary"}>
                    {section.complete ? "Готово" : "Нужно заполнить"}
                  </Badge>
                </div>
                {section.blockingReasons.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {section.blockingReasons.join(" ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">
            Переходы статуса
          </div>
          <div className="space-y-3">
            {transitionReadiness.map((item) => (
              <button
                key={item.targetStatus}
                className="flex w-full items-start justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent/40"
                onClick={() => {
                  if (!item.allowed) {
                    onBlockedTransitionClick(item.targetStatus);
                  }
                }}
                type="button"
              >
                <div className="space-y-1">
                  <div className="font-medium">{STATUS_LABELS[item.targetStatus]}</div>
                  {!item.allowed && item.blockers[0] && (
                    <div className="text-sm text-muted-foreground">
                      {item.blockers[0].message}
                    </div>
                  )}
                </div>
                <Badge variant={item.allowed ? "default" : "secondary"}>
                  {item.allowed ? "Доступно" : "Заблокировано"}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ListChecks className="h-4 w-4" />
            Этапы исполнения
          </div>
          <div className="space-y-3">
            {executionPlan.map((leg) => {
              const nextStates = LEG_STATE_TRANSITIONS[leg.state];
              const legKey = String(leg.idx);

              return (
                <div
                  key={`${leg.idx}:${leg.kind}`}
                  className="rounded-lg border p-4 transition-colors hover:bg-accent/30"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {leg.idx}. {DEAL_LEG_KIND_LABELS[leg.kind]}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {leg.kind}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={DEAL_LEG_STATE_COLORS[leg.state]}>
                        {DEAL_LEG_STATE_LABELS[leg.state]}
                      </Badge>
                      {nextStates.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isUpdatingLegKey === legKey}
                              />
                            }
                          >
                            Изменить
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {nextStates.map((state) => (
                              <DropdownMenuItem
                                key={state}
                                disabled={isUpdatingLegKey === legKey}
                                onClick={() => onUpdateLegState(leg.idx, state)}
                              >
                                {DEAL_LEG_STATE_LABELS[state]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
