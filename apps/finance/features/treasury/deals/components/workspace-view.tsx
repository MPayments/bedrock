import {
  AlertCircle,
  Clock3,
  FileText,
  ListChecks,
  Wallet,
} from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";
import {
  formatCapabilityIssue,
  formatDealNextAction,
  formatDealWorkflowMessage,
  formatOperationalPositionIssue,
  getDealQuoteStatusLabel,
  getDealQuoteStatusVariant,
  getDealTimelineEventLabel,
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
  isPrimaryOperationalPositionVisible,
} from "@/features/treasury/deals/labels";
import { formatDate } from "@/lib/format";

type FinanceDealWorkspaceViewProps = {
  deal: FinanceDealWorkspace;
};

function collectPreviewBlockers(deal: FinanceDealWorkspace) {
  const messages = new Set<string>();

  deal.queueContext.blockers.forEach((blocker) =>
    messages.add(formatDealWorkflowMessage(blocker)),
  );

  deal.attachmentRequirements
    .filter((item) => item.state === "missing")
    .forEach((item) =>
      item.blockingReasons.forEach((reason) =>
        messages.add(formatDealWorkflowMessage(reason)),
      ),
    );

  deal.formalDocumentRequirements
    .filter((item) => item.state === "missing" || item.state === "in_progress")
    .forEach((item) =>
      item.blockingReasons.forEach((reason) =>
        messages.add(formatDealWorkflowMessage(reason)),
      ),
    );

  deal.operationalState.capabilities
    .filter((item) => item.status !== "enabled")
    .forEach((item) =>
      messages.add(
        formatCapabilityIssue({
          kind: item.kind,
          status: item.status,
        }),
      ),
    );

  deal.operationalState.positions
    .filter(
      (item) =>
        isPrimaryOperationalPositionVisible(item.kind) && item.state === "blocked",
    )
    .forEach((item) =>
      messages.add(
        formatOperationalPositionIssue({
          kind: item.kind,
        }),
      ),
    );

  return Array.from(messages).slice(0, 3);
}

function getExecutionIssuesCount(deal: FinanceDealWorkspace) {
  return (
    deal.executionPlan.filter((item) => item.state === "blocked").length +
    deal.operationalState.capabilities.filter((item) => item.status !== "enabled")
      .length +
    deal.operationalState.positions.filter(
      (item) =>
        isPrimaryOperationalPositionVisible(item.kind) && item.state === "blocked",
    ).length
  );
}

export function FinanceDealWorkspaceView({
  deal,
}: FinanceDealWorkspaceViewProps) {
  const blockers = collectPreviewBlockers(deal);

  return (
    <div className="space-y-6">
      <Card className="border-muted-foreground/10 bg-gradient-to-br from-background via-background to-muted/30">
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getFinanceDealStatusVariant(deal.summary.status)}>
              {getFinanceDealStatusLabel(deal.summary.status)}
            </Badge>
            <Badge variant={getFinanceDealQueueVariant(deal.queueContext.queue)}>
              {getFinanceDealQueueLabel(deal.queueContext.queue)}
            </Badge>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {getFinanceDealTypeLabel(deal.summary.type)}
            </h3>
            <div className="text-sm text-muted-foreground">
              {deal.summary.applicantDisplayName ?? "Заявитель не указан"} ·{" "}
              {deal.summary.internalEntityDisplayName ?? "Организация не указана"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-background/70 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Создана
              </div>
              <div className="mt-1 font-medium">{formatDate(deal.summary.createdAt)}</div>
            </div>
            <div className="rounded-lg border bg-background/70 px-3 py-3 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Следующий шаг
              </div>
              <div className="mt-1 font-medium">
                {formatDealNextAction(deal.nextAction)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Котировки и расчет
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Котировок</span>
              <span className="font-medium">{deal.relatedResources.quotes.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Принятая котировка</span>
              <span className="font-medium">
                {deal.acceptedQuote
                  ? getDealQuoteStatusLabel(deal.acceptedQuote.quoteStatus)
                  : "Не принята"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Расчет</span>
              <span className="font-medium">
                {deal.summary.calculationId ? "Есть актуальная версия" : "Не создан"}
              </span>
            </div>
            {deal.acceptedQuote ? (
              <div className="rounded-lg bg-muted/40 px-3 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant={getDealQuoteStatusVariant(deal.acceptedQuote.quoteStatus)}>
                    {getDealQuoteStatusLabel(deal.acceptedQuote.quoteStatus)}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Принята: {formatDate(deal.acceptedQuote.acceptedAt)}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Документы
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Подтверждающие файлы</span>
              <span className="font-medium">
                {deal.relatedResources.attachments.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Внутренние документы</span>
              <span className="font-medium">
                {deal.relatedResources.formalDocuments.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Нужно приложить</span>
              <span className="font-medium">
                {deal.attachmentRequirements.filter((item) => item.state === "missing").length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              Исполнение
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Этапы исполнения</span>
              <span className="font-medium">{deal.executionPlan.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Заблокировано этапов</span>
              <span className="font-medium">
                {deal.executionPlan.filter((item) => item.state === "blocked").length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Операционных вопросов</span>
              <span className="font-medium">{getExecutionIssuesCount(deal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Что блокирует
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {blockers.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {blockers.map((blocker) => (
                <li key={blocker} className="rounded-md border px-3 py-2">
                  {blocker}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">
              Критичных блокировок сейчас нет.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            Таймлайн
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {deal.timeline.slice(0, 6).map((event) => (
            <div key={event.id} className="rounded-lg border px-3 py-3">
              <div className="text-sm font-medium">
                {getDealTimelineEventLabel(event.type)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDate(event.occurredAt)}
                {event.actor?.label ? ` · ${event.actor.label}` : ""}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
