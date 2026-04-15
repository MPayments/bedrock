import { ListChecks, ShieldCheck, Workflow } from "lucide-react";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

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
  DealStatus,
} from "./types";

type ExecutionPlanCardProps = {
  executionPlan: ApiDealWorkflowLeg[];
  onBlockedTransitionClick: (status: DealStatus) => void;
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function ExecutionPlanCard({
  executionPlan,
  onBlockedTransitionClick,
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
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              Этапы исполнения
            </div>
            <Badge
              className="gap-1 whitespace-nowrap"
              variant="secondary"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Управление в Finance
            </Badge>
          </div>
          <div className="space-y-3">
            {executionPlan.map((leg) => {
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
