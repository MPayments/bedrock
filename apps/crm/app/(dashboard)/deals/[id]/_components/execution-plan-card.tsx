import { AlertCircle, ListChecks, Workflow } from "lucide-react";

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
} from "./constants";
import type {
  ApiDealSectionCompleteness,
  ApiDealTransitionReadiness,
  ApiDealWorkflowLeg,
} from "./types";

type ExecutionPlanCardProps = {
  executionPlan: ApiDealWorkflowLeg[];
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
};

const VISIBLE_LEG_STATES = new Set<ApiDealWorkflowLeg["state"]>([
  "blocked",
  "in_progress",
  "ready",
]);

function collectBlockingItems(input: {
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
}) {
  const messages = new Map<string, string>();

  input.sectionCompleteness.forEach((section) => {
    if (section.complete || section.blockingReasons.length === 0) {
      return;
    }

    const sectionLabel =
      DEAL_SECTION_LABELS[section.sectionId] ?? section.sectionId;
    section.blockingReasons.forEach((reason) => {
      const message = `${sectionLabel}: ${formatDealWorkflowMessage(reason)}`;
      messages.set(message, message);
    });
  });

  input.transitionReadiness.forEach((item) => {
    if (item.allowed || item.blockers.length === 0) {
      return;
    }

    item.blockers.forEach((blocker) => {
      const message = formatDealWorkflowMessage(blocker.message);
      messages.set(message, message);
    });
  });

  return Array.from(messages.values());
}

export function ExecutionPlanCard({
  executionPlan,
  sectionCompleteness,
  transitionReadiness,
}: ExecutionPlanCardProps) {
  const blockingItems = collectBlockingItems({
    sectionCompleteness,
    transitionReadiness,
  });
  const visibleLegs = executionPlan.filter((leg) =>
    VISIBLE_LEG_STATES.has(leg.state),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-muted-foreground" />
          Исполнение и готовность
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {blockingItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Что мешает продолжить
            </div>
            <div className="space-y-2">
              {blockingItems.map((message) => (
                <div
                  key={message}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  {message}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Критичных блокеров сейчас нет.
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ListChecks className="h-4 w-4" />
            Текущие этапы исполнения
          </div>
          {visibleLegs.length > 0 ? (
            <div className="space-y-2">
              {visibleLegs.map((leg) => (
                <div
                  key={`${leg.idx}:${leg.kind}`}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="font-medium">
                    {leg.idx}. {DEAL_LEG_KIND_LABELS[leg.kind]}
                  </div>
                  <Badge className={DEAL_LEG_STATE_COLORS[leg.state]}>
                    <span data-testid={`deal-leg-state-badge-${leg.idx}`}>
                      {DEAL_LEG_STATE_LABELS[leg.state]}
                    </span>
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Активных этапов исполнения сейчас нет.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
