import { ChevronDown, ListChecks, Workflow } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
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
  formatDealWorkflowMessage,
  STATUS_LABELS,
} from "./constants";
import type {
  ApiDealSectionCompleteness,
  ApiDealTransitionReadiness,
  ApiDealWorkflowLeg,
  DealLegManualOverride,
  DealLegState,
  DealStatus,
} from "./types";

// Leg state is derived from instruction state + posted documents (+ manual
// override). Operators can only apply two safety-valve overrides manually:
// `blocked` (operator-halted, has to be cleared via «Устранить блокер») and
// `skipped` (operator decided to skip the leg). Forward transitions are no
// longer manual — they happen automatically as instructions settle and docs
// get posted.
const OVERRIDE_LABELS: Record<DealLegManualOverride, string> = {
  blocked: "Заблокировать",
  skipped: "Пропустить",
};

function availableLegOverrides(
  currentState: DealLegState,
): DealLegManualOverride[] {
  if (currentState === "done" || currentState === "skipped") {
    return [];
  }
  if (currentState === "blocked") {
    return ["skipped"];
  }
  return ["blocked", "skipped"];
}

type ExecutionPlanCardProps = {
  executionPlan: ApiDealWorkflowLeg[];
  isUpdatingLegKey: string | null;
  onBlockedTransitionClick: (status: DealStatus) => void;
  onOverrideLeg: (idx: number, override: DealLegManualOverride) => void;
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function ExecutionPlanCard({
  executionPlan,
  isUpdatingLegKey,
  onBlockedTransitionClick,
  onOverrideLeg,
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
                    {DEAL_SECTION_LABELS[section.sectionId] ??
                      section.sectionId}
                  </div>
                  <Badge variant={section.complete ? "default" : "secondary"}>
                    {section.complete ? "Готово" : "Нужно заполнить"}
                  </Badge>
                </div>
                {section.blockingReasons.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {section.blockingReasons
                      .map((reason) => formatDealWorkflowMessage(reason))
                      .join(" ")}
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
                  <div className="font-medium">
                    {STATUS_LABELS[item.targetStatus]}
                  </div>
                  {!item.allowed && item.blockers[0] && (
                    <div className="text-sm text-muted-foreground">
                      {formatDealWorkflowMessage(item.blockers[0].message)}
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
              const overrides = availableLegOverrides(leg.state);
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
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={DEAL_LEG_STATE_COLORS[leg.state]}>
                        <span data-testid={`deal-leg-state-badge-${leg.idx}`}>
                          {DEAL_LEG_STATE_LABELS[leg.state]}
                        </span>
                      </Badge>
                      {overrides.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                data-testid={`deal-leg-override-button-${leg.idx}`}
                                size="sm"
                                variant="outline"
                                disabled={isUpdatingLegKey === legKey}
                              />
                            }
                          >
                            Действия
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {overrides.map((override) => (
                              <DropdownMenuItem
                                key={override}
                                data-testid={`deal-leg-override-option-${leg.idx}-${override}`}
                                disabled={isUpdatingLegKey === legKey}
                                onClick={() => onOverrideLeg(leg.idx, override)}
                              >
                                {OVERRIDE_LABELS[override]}
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
