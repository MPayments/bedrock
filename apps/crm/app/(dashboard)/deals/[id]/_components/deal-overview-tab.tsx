import {
  AlertCircle,
  ArrowRight,
  FileText,
  Wallet,
  Workflow,
} from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { cn } from "@/lib/utils";

import type { DealPageTab } from "./deal-tabs";
import {
  DEAL_CAPABILITY_STATUS_LABELS,
  DEAL_LEG_STATE_LABELS,
  DEAL_QUOTE_STATUS_LABELS,
  formatDealNextAction,
  formatDealWorkflowMessage,
  getDealWorkflowMessageTone,
} from "./constants";
import { DealInfoCard } from "./deal-info-card";
import { formatDate } from "./format";
import type {
  ApiAttachment,
  ApiCrmDealWorkbenchProjection,
  ApiCurrency,
  ApiDealDetails,
  ApiDealWorkflowProjection,
  ApiFormalDocument,
  CalculationView,
} from "./types";

type DealOverviewTabProps = {
  attachments: ApiAttachment[];
  calculation: CalculationView | null;
  commentValue: string;
  deal: ApiDealDetails;
  formalDocuments: ApiFormalDocument[];
  isEditingComment: boolean;
  isSavingComment: boolean;
  onCommentChange: (value: string) => void;
  onNavigateToTab: (tab: DealPageTab) => void;
  onCancelEdit: () => void;
  onEditComment: () => void;
  onSaveComment: () => void;
  requestedCurrency: ApiCurrency | null;
  workbench: ApiCrmDealWorkbenchProjection;
  workflow: ApiDealWorkflowProjection;
};

function collectTopBlockers(
  workbench: ApiCrmDealWorkbenchProjection,
  workflow: ApiDealWorkflowProjection,
) {
  const messages = new Set<string>();

  workflow.transitionReadiness.forEach((item) => {
    if (!item.allowed) {
      item.blockers.forEach((blocker) => messages.add(blocker.message));
    }
  });
  workflow.sectionCompleteness.forEach((section) => {
    if (!section.complete) {
      section.blockingReasons.forEach((reason) => messages.add(reason));
    }
  });
  workbench.evidenceRequirements.forEach((requirement) => {
    if (requirement.state === "missing") {
      requirement.blockingReasons.forEach((reason) => messages.add(reason));
    }
  });
  workbench.documentRequirements.forEach((requirement) => {
    if (
      requirement.state === "missing" ||
      requirement.state === "in_progress"
    ) {
      requirement.blockingReasons.forEach((reason) => messages.add(reason));
    }
  });

  return Array.from(messages).slice(0, 4);
}

export function DealOverviewTab({
  attachments,
  calculation,
  commentValue,
  deal,
  formalDocuments,
  isEditingComment,
  isSavingComment,
  onCommentChange,
  onNavigateToTab,
  onCancelEdit,
  onEditComment,
  onSaveComment,
  requestedCurrency,
  workbench,
  workflow,
}: DealOverviewTabProps) {
  const blockers = collectTopBlockers(workbench, workflow);
  const missingEvidenceCount = workbench.evidenceRequirements.filter(
    (requirement) => requirement.state === "missing",
  ).length;
  const missingDocumentCount = workbench.documentRequirements.filter(
    (requirement) => requirement.state === "missing",
  ).length;
  const blockedLegCount = workflow.executionPlan.filter(
    (leg) => leg.state === "blocked",
  ).length;
  const activeLegCount = workflow.executionPlan.filter(
    (leg) => leg.state === "in_progress" || leg.state === "ready",
  ).length;
  const capabilityIssueCount = workflow.operationalState.capabilities.filter(
    (capability) => capability.status !== "enabled",
  ).length;
  const blockedPositionCount = workflow.operationalState.positions.filter(
    (position) => position.state === "blocked",
  ).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Что нужно сделать сейчас
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-lg bg-muted/40 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Следующий шаг
            </div>
            <div className="mt-1 text-base font-medium">
              {formatDealNextAction(workbench.nextAction)}
            </div>
          </div>

          {blockers.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Что блокирует движение сделки
              </div>
              <ul className="space-y-2 text-sm">
                {blockers.map((blocker) => (
                  <li
                    key={blocker}
                    className={cn(
                      "rounded-md border px-3 py-2",
                      getDealWorkflowMessageTone(blocker) === "warning" &&
                        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
                    )}
                  >
                    {formatDealWorkflowMessage(blocker)}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Критичных блокировок сейчас нет.
            </div>
          )}
        </CardContent>
      </Card>

      <DealInfoCard
        commentValue={commentValue}
        deal={deal}
        isEditingComment={isEditingComment}
        isSavingComment={isSavingComment}
        onCancelEdit={onCancelEdit}
        onCommentChange={onCommentChange}
        onEditComment={onEditComment}
        onSaveComment={onSaveComment}
        requestedCurrency={requestedCurrency}
      />
    </div>
  );
}
