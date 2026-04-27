import {
  AlertCircle,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { PrintFormActions } from "@bedrock/sdk-print-forms-ui/components/print-form-actions";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { DealTimelineCard } from "@/features/treasury/deals/components/deal-timeline-card";
import { ExecutionSummaryRail } from "@/features/treasury/deals/components/execution-summary-rail";
import {
  collectFinanceDealTopBlockers,
  getFinanceDealExecutionProgress,
} from "@/features/treasury/deals/lib/execution-summary";
import type { FinanceDealWorkspace } from "@/features/treasury/deals/lib/queries";
import {
  formatDealNextAction,
  formatDealWorkflowMessage,
  getDealQuoteStatusLabel,
  getDealQuoteStatusVariant,
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
} from "@/features/treasury/deals/labels";
import { formatDate, formatMinorAmountWithCurrency } from "@/lib/format";

type FinanceDealWorkspaceViewProps = {
  deal: FinanceDealWorkspace;
};

function formatProfitabilityAmounts(
  items: NonNullable<FinanceDealWorkspace["profitabilitySnapshot"]>["feeRevenue"],
) {
  if (!items || items.length === 0) {
    return "0";
  }

  return items
    .map((item) =>
      formatMinorAmountWithCurrency(item.amountMinor, item.currencyCode),
    )
    .join(" · ");
}

export function FinanceDealWorkspaceView({
  deal,
}: FinanceDealWorkspaceViewProps) {
  const blockers = collectFinanceDealTopBlockers(deal);
  const executionProgress = getFinanceDealExecutionProgress(deal);
  const printFormClient = { baseUrl: "/v1" };
  const closeReadinessBlockers = deal.closeReadiness.blockers.map((blocker) =>
    formatDealWorkflowMessage(blocker),
  );

  const reconciliationStateLabel =
    deal.reconciliationSummary.state === "blocked"
      ? "Есть исключения"
      : deal.reconciliationSummary.state === "clear"
        ? "Сверка завершена"
        : deal.reconciliationSummary.state === "pending"
          ? "Сверка ожидается"
          : "Сверка не требуется";
  const reconciliationVariant =
    deal.reconciliationSummary.state === "blocked"
      ? "destructive"
      : deal.reconciliationSummary.state === "clear"
        ? "default"
        : deal.reconciliationSummary.state === "pending"
          ? "secondary"
          : "outline";

  return (
    <div className="space-y-6">
      <Card className="border-muted-foreground/10 bg-gradient-to-br from-background via-background to-muted/30">
        <CardContent className="space-y-5 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getFinanceDealStatusVariant(deal.summary.status)}>
                {getFinanceDealStatusLabel(deal.summary.status)}
              </Badge>
              <Badge variant={getFinanceDealQueueVariant(deal.queueContext.queue)}>
                {getFinanceDealQueueLabel(deal.queueContext.queue)}
              </Badge>
            </div>
            <PrintFormActions
              client={printFormClient}
              forms={deal.printForms.deal}
              owner={{ type: "deal", dealId: deal.summary.id }}
              size="sm"
            />
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

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_repeat(3,minmax(0,180px))]">
            <div className="rounded-lg border bg-background/70 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Причина очереди
              </div>
              <div className="mt-1 font-medium">
                {formatDealWorkflowMessage(deal.queueContext.queueReason)}
              </div>
            </div>
            <div className="rounded-lg border bg-background/70 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Следующий шаг
              </div>
              <div className="mt-1 font-medium">
                {formatDealNextAction(deal.nextAction)}
              </div>
            </div>
            <div className="rounded-lg border bg-background/70 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Завершено
              </div>
              <div className="mt-1 text-lg font-semibold">
                {executionProgress.doneLegCount}/{executionProgress.totalLegCount}
              </div>
            </div>
            <div className="rounded-lg border bg-background/70 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Заблокировано
              </div>
              <div className="mt-1 text-lg font-semibold">
                {executionProgress.blockedLegCount}
              </div>
            </div>
            <div className="rounded-lg border bg-background/70 px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Операционных вопросов
              </div>
              <div className="mt-1 text-lg font-semibold">
                {executionProgress.issueCount}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExecutionSummaryRail deal={deal} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Закрытие и результат
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Комиссионный доход</span>
              <span className="font-medium">
                {deal.profitabilitySnapshot
                  ? formatProfitabilityAmounts(deal.profitabilitySnapshot.feeRevenue)
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Доход от спреда</span>
              <span className="font-medium">
                {deal.profitabilitySnapshot
                  ? formatProfitabilityAmounts(
                      deal.profitabilitySnapshot.spreadRevenue,
                    )
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Расходы провайдера</span>
              <span className="font-medium">
                {deal.profitabilitySnapshot
                  ? formatProfitabilityAmounts(
                      deal.profitabilitySnapshot.providerFeeExpense,
                    )
                  : "—"}
              </span>
            </div>
            <div className="rounded-lg border px-3 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Критерии закрытия
              </div>
              <div className="mt-2 space-y-2">
                {deal.closeReadiness.criteria.map((criterion) => (
                  <div key={criterion.code} className="flex items-start gap-2">
                    {criterion.satisfied ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                    )}
                    <span>{criterion.label}</span>
                  </div>
                ))}
              </div>
              {closeReadinessBlockers.length > 0 ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  {closeReadinessBlockers.join(" ")}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Сверка
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Статус</span>
              <Badge variant={reconciliationVariant}>
                {reconciliationStateLabel}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Требуют сверки</span>
              <span className="font-medium">
                {deal.reconciliationSummary.requiredOperationCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Исключений</span>
              <span className="font-medium">
                {deal.reconciliationSummary.openExceptionCount}
              </span>
            </div>
            {deal.relatedResources.reconciliationExceptions.length > 0 ? (
              <div className="rounded-lg border px-3 py-3 text-xs text-muted-foreground">
                Последнее исключение:{" "}
                {deal.relatedResources.reconciliationExceptions[0]?.reasonCode ?? "—"}
              </div>
            ) : null}
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

      <div className="grid gap-4 xl:grid-cols-2">
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
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Котировки и расчет
            </CardTitle>
            {deal.summary.calculationId ? (
              <PrintFormActions
                client={printFormClient}
                forms={deal.printForms.calculation}
                owner={{
                  type: "calculation",
                  calculationId: deal.summary.calculationId,
                }}
                size="sm"
              />
            ) : null}
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
      </div>

      <DealTimelineCard
        executionPlan={deal.executionPlan}
        timeline={deal.timeline}
        maxItems={6}
      />
    </div>
  );
}
