import { AlertCircle, ArrowRight, FileText, Wallet, Workflow } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { DealPageTab } from "./deal-tabs";
import {
  DEAL_CAPABILITY_STATUS_LABELS,
  DEAL_LEG_STATE_LABELS,
  DEAL_QUOTE_STATUS_LABELS,
  formatDealNextAction,
  formatDealWorkflowMessage,
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
    if (requirement.state === "missing" || requirement.state === "in_progress") {
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
                  <li key={blocker} className="rounded-md border px-3 py-2">
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Котировка и расчет
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Котировка</span>
                <span className="font-medium">
                  {workflow.acceptedQuote
                    ? DEAL_QUOTE_STATUS_LABELS[workflow.acceptedQuote.quoteStatus] ??
                      workflow.acceptedQuote.quoteStatus
                    : workbench.pricing.quoteEligibility
                      ? "Не принята"
                      : "Не требуется"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Срок действия</span>
                <span className="font-medium">
                  {formatDate(workflow.acceptedQuote?.expiresAt ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Расчет</span>
                <span className="font-medium">
                  {calculation ? "Есть актуальная версия" : "Не создан"}
                </span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => onNavigateToTab("pricing")}
              variant="outline"
            >
              Открыть вкладку
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Документы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Подтверждающие файлы</span>
                <span className="font-medium">{attachments.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Не хватает файлов</span>
                <span className="font-medium">{missingEvidenceCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Внутренние документы</span>
                <span className="font-medium">{formalDocuments.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Не хватает документов</span>
                <span className="font-medium">{missingDocumentCount}</span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => onNavigateToTab("documents")}
              variant="outline"
            >
              Открыть вкладку
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-muted-foreground" />
              Исполнение
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Этапы в работе</span>
                <span className="font-medium">{activeLegCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Заблокированные этапы</span>
                <span className="font-medium">
                  {blockedLegCount > 0
                    ? `${blockedLegCount} · ${DEAL_LEG_STATE_LABELS.blocked}`
                    : "Нет"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Операционные ограничения</span>
                <span className="font-medium">{capabilityIssueCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Проблемные позиции</span>
                <span className="font-medium">{blockedPositionCount}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {workflow.operationalState.capabilities
                .filter((capability) => capability.status !== "enabled")
                .slice(0, 2)
                .map((capability) => (
                  <Badge key={capability.kind} variant="outline">
                    {DEAL_CAPABILITY_STATUS_LABELS[capability.status]}
                  </Badge>
                ))}
            </div>
            <Button
              className="w-full"
              onClick={() => onNavigateToTab("execution")}
              variant="outline"
            >
              Открыть вкладку
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
