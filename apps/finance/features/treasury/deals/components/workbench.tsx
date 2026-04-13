"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  Paperclip,
  FileText,
  File,
  Info,
  ListChecks,
  ShieldCheck,
  Trash2,
  Upload,
  Wallet,
  WalletCards,
  Workflow,
} from "lucide-react";

import { Alert, AlertDescription } from "@bedrock/sdk-ui/components/alert";
import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import {
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";
import {
  getApprovalStatusLabel,
  getPostingStatusLabel,
  getSubmissionStatusLabel,
} from "@/features/documents/lib/status-labels";
import {
  buildDocumentCreateHref,
  buildDocumentDetailsHref,
} from "@/features/documents/lib/routes";
import { formatRate } from "@/features/treasury/rates/lib/format";
import type {
  FinanceDealQuoteItem,
  FinanceDealWorkbench,
  FinanceProfitabilityAmount,
} from "@/features/treasury/deals/lib/queries";
import {
  collectFinanceDealTopBlockers,
  getFinanceDealExecutionProgress,
} from "@/features/treasury/deals/lib/execution-summary";
import {
  formatDealNextAction,
  formatDealWorkflowMessage,
  formatOperationalPositionIssue,
  getAttachmentVisibilityLabel,
  getDealAttachmentRequirementStateLabel,
  getDealFormalDocumentRequirementStateLabel,
  getDealLegKindLabel,
  getDealLegStateLabel,
  getDealOperationalPositionStateLabel,
  getDealOperationalPositionStateVariant,
  getDealQuoteStatusLabel,
  getDealQuoteStatusVariant,
  getFinanceDealDisplayTitle,
  getFinanceDealQueueLabel,
  getFinanceDealQueueVariant,
  getFinanceDealStatusLabel,
  getFinanceDealStatusVariant,
  getFinanceDealTypeLabel,
  getFinancePrimaryOperationalPositionLabel,
  getFormalDocumentLabel,
  getFormalDocumentStageLabel,
  isPrimaryOperationalPositionVisible,
} from "@/features/treasury/deals/labels";
import {
  getTreasuryOperationInstructionStatusLabel,
  getTreasuryOperationInstructionStatusVariant,
  getTreasuryOperationKindLabel,
  getTreasuryOperationKindVariant,
} from "@/features/treasury/operations/lib/labels";
import { executeMutation } from "@/lib/resources/http";
import {
  formatDate,
  formatMajorAmount,
  formatMinorAmountWithCurrency,
} from "@/lib/format";

import { ExecutionSummaryRail } from "./execution-summary-rail";
import { DealTimelineCard } from "./deal-timeline-card";
import { formatFileSize, getFileIcon } from "./file-utils";
import { QuoteRequestDialog } from "./quote-request-dialog";
import { UploadAttachmentDialog } from "./upload-attachment-dialog";
import { FinanceDealWorkspaceLayout } from "./workspace-layout";

type DealPageTab = "overview" | "pricing" | "documents" | "execution";

const DEFAULT_DEAL_PAGE_TAB: DealPageTab = "execution";
const DEAL_PAGE_TAB_META: Array<{
  icon: typeof Wallet;
  label: string;
  value: DealPageTab;
}> = [
  {
    icon: Workflow,
    label: "Исполнение",
    value: "execution",
  },
  {
    icon: Info,
    label: "Информация",
    value: "overview",
  },
  {
    icon: FileText,
    label: "Документы",
    value: "documents",
  },
  {
    icon: Wallet,
    label: "Котировки и расчет",
    value: "pricing",
  },
];

function isDealPageTab(value: string | null): value is DealPageTab {
  return (
    value === "overview" ||
    value === "pricing" ||
    value === "documents" ||
    value === "execution"
  );
}

function getDealTabHref(
  pathname: string,
  searchParams: { toString(): string },
  tab: DealPageTab,
) {
  const params = new URLSearchParams(searchParams.toString());

  if (tab === DEFAULT_DEAL_PAGE_TAB) {
    params.delete("tab");
  } else {
    params.set("tab", tab);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getQuoteCreationDisabledReason(deal: FinanceDealWorkbench) {
  if (!deal.pricing.quoteEligibility) {
    return "Котировка доступна только для сделок с обменом валют.";
  }

  if (!deal.actions.canCreateQuote) {
    return "Сейчас нельзя запросить котировку для этой сделки.";
  }

  if (!deal.pricing.quoteAmount) {
    return "У сделки нет суммы для запроса котировки.";
  }

  if (!deal.pricing.sourceCurrencyId) {
    return "У сделки не указана валюта списания.";
  }

  if (
    deal.pricing.quoteAmountSide === "target" &&
    !deal.pricing.targetCurrencyId
  ) {
    return "У сделки не указана валюта оплаты.";
  }

  return null;
}

function getCalculationDisabledReason(deal: FinanceDealWorkbench) {
  if (deal.summary.calculationId) {
    return "По сделке уже привязан актуальный расчет.";
  }

  if (!deal.acceptedQuote) {
    return "Сначала примите котировку.";
  }

  if (deal.acceptedQuote.quoteStatus !== "active") {
    return "Создать расчет можно только по действующей принятой котировке.";
  }

  if (!deal.actions.canCreateCalculation) {
    return "Создать расчет сейчас нельзя.";
  }

  return null;
}

function formatQuoteAmountsSummary(
  quote: Pick<
    FinanceDealQuoteItem,
    "fromAmount" | "fromCurrency" | "toAmount" | "toCurrency"
  >,
) {
  return `${quote.fromAmount} ${quote.fromCurrency} → ${quote.toAmount} ${quote.toCurrency}`;
}

function formatQuoteRateSummary(
  quote: Pick<
    FinanceDealQuoteItem,
    "fromCurrency" | "rateDen" | "rateNum" | "toCurrency"
  >,
) {
  return `${formatMajorAmount(formatRate(quote.rateNum, quote.rateDen))} ${
    quote.toCurrency
  } за 1 ${quote.fromCurrency}`;
}

function getAcceptedQuoteDetails(deal: FinanceDealWorkbench) {
  const acceptedQuoteId = deal.acceptedQuote?.quoteId;

  if (!acceptedQuoteId) {
    return null;
  }

  if (deal.acceptedQuoteDetails?.id === acceptedQuoteId) {
    return deal.acceptedQuoteDetails;
  }

  return (
    deal.quoteHistory.find((quote) => quote.id === acceptedQuoteId) ?? null
  );
}

function getQuoteItemsForDisplay(deal: FinanceDealWorkbench) {
  const acceptedQuoteDetails = getAcceptedQuoteDetails(deal);

  if (deal.quoteHistory.length === 0) {
    return acceptedQuoteDetails ? [acceptedQuoteDetails] : [];
  }

  if (
    acceptedQuoteDetails &&
    !deal.quoteHistory.some((quote) => quote.id === acceptedQuoteDetails.id)
  ) {
    return [acceptedQuoteDetails, ...deal.quoteHistory];
  }

  return deal.quoteHistory;
}

function findQuoteDetailsById(
  deal: FinanceDealWorkbench,
  quoteId: string | null | undefined,
) {
  if (!quoteId) {
    return null;
  }

  if (deal.acceptedQuoteDetails?.id === quoteId) {
    return deal.acceptedQuoteDetails;
  }

  return deal.quoteHistory.find((quote) => quote.id === quoteId) ?? null;
}

function refreshPage(router: ReturnType<typeof useRouter>) {
  router.refresh();
}

type DealContextContentProps = {
  deal: FinanceDealWorkbench;
};

function DealContextContent({ deal }: DealContextContentProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Тип сделки</div>
        <div className="font-medium">
          {getFinanceDealTypeLabel(deal.summary.type)}
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Создана</div>
        <div className="font-medium">{formatDate(deal.summary.createdAt)}</div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Статус</div>
        <div>
          <Badge
            data-testid="finance-deal-status-badge"
            variant={getFinanceDealStatusVariant(deal.summary.status)}
          >
            {getFinanceDealStatusLabel(deal.summary.status)}
          </Badge>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">Очередь</div>
        <div>
          <Badge variant={getFinanceDealQueueVariant(deal.queueContext.queue)}>
            {getFinanceDealQueueLabel(deal.queueContext.queue)}
          </Badge>
        </div>
      </div>
      <div className="space-y-1 text-sm sm:col-span-2">
        <div className="text-muted-foreground">Заявитель</div>
        <div className="font-medium">
          {deal.summary.applicantDisplayName ?? "Не указан"}
        </div>
      </div>
      <div className="space-y-1 text-sm sm:col-span-2">
        <div className="text-muted-foreground">Организация</div>
        <div className="font-medium">
          {deal.summary.internalEntityDisplayName ?? "Не указана"}
        </div>
      </div>
    </div>
  );
}

type OverviewTabProps = {
  deal: FinanceDealWorkbench;
};

function OverviewTab({ deal }: OverviewTabProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Обзор сделки</CardTitle>
            <div className="text-sm text-muted-foreground">
              {getFinanceDealTypeLabel(deal.summary.type)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getFinanceDealStatusVariant(deal.summary.status)}>
              {getFinanceDealStatusLabel(deal.summary.status)}
            </Badge>
            <Badge
              variant={getFinanceDealQueueVariant(deal.queueContext.queue)}
            >
              {getFinanceDealQueueLabel(deal.queueContext.queue)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="text-sm font-medium">Контекст сделки</div>
          <DealContextContent deal={deal} />
        </div>
      </CardContent>
    </Card>
  );
}

function DealExecutionHeaderSummary({ deal }: { deal: FinanceDealWorkbench }) {
  const blockers = collectFinanceDealTopBlockers(deal);
  const executionProgress = getFinanceDealExecutionProgress(deal);

  return (
    <Card className="border-muted-foreground/10 bg-gradient-to-br from-background via-background to-muted/30">
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getFinanceDealStatusVariant(deal.summary.status)}>
            {getFinanceDealStatusLabel(deal.summary.status)}
          </Badge>
          <Badge variant={getFinanceDealQueueVariant(deal.queueContext.queue)}>
            {getFinanceDealQueueLabel(deal.queueContext.queue)}
          </Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_repeat(3,minmax(0,180px))]">
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Причина очереди
            </div>
            <div className="mt-1 text-sm font-medium">
              {formatDealWorkflowMessage(deal.queueContext.queueReason)}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Следующий шаг
            </div>
            <div className="mt-1 text-sm font-medium">
              {formatDealNextAction(deal.nextAction)}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Завершено
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.doneLegCount}/{executionProgress.totalLegCount}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Заблокировано
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.blockedLegCount}
            </div>
          </div>
          <div className="rounded-lg border bg-background/70 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Операционных вопросов
            </div>
            <div className="mt-1 text-lg font-semibold">
              {executionProgress.issueCount}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Что мешает движению сделки</div>
          {blockers.length > 0 ? (
            <div className="space-y-2">
              {blockers.map((blocker) => (
                <Alert key={blocker} variant="warning" className="py-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{blocker}</AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Критичных блокировок сейчас нет.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type PricingTabProps = {
  calculationDisabledReason: string | null;
  deal: FinanceDealWorkbench;
  isAcceptingQuoteId: string | null;
  isCreatingCalculation: boolean;
  onAcceptQuote: (quoteId: string) => void;
  onCreateCalculation: () => void;
  onOpenQuoteDialog: () => void;
  quoteCreationDisabledReason: string | null;
};

function PricingTab({
  calculationDisabledReason,
  deal,
  isAcceptingQuoteId,
  isCreatingCalculation,
  onAcceptQuote,
  onCreateCalculation,
  onOpenQuoteDialog,
  quoteCreationDisabledReason,
}: PricingTabProps) {
  const acceptedQuoteDetails = getAcceptedQuoteDetails(deal);
  const quoteItems = getQuoteItemsForDisplay(deal);
  const activeCalculation =
    deal.calculationHistory.find(
      (item) => item.calculationId === deal.summary.calculationId,
    ) ??
    deal.calculationHistory[0] ??
    null;
  const activeCalculationQuote =
    findQuoteDetailsById(deal, activeCalculation?.sourceQuoteId) ??
    acceptedQuoteDetails;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Котировки
          </CardTitle>
          <Button
            size="sm"
            disabled={Boolean(quoteCreationDisabledReason)}
            onClick={onOpenQuoteDialog}
          >
            Запросить котировку
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {quoteCreationDisabledReason ? (
            <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {quoteCreationDisabledReason}
            </div>
          ) : null}

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium">Текущая принятая котировка</div>
                <div className="text-sm text-muted-foreground">
                  {deal.acceptedQuote
                    ? `Принята ${formatDate(deal.acceptedQuote.acceptedAt)}`
                    : "Котировка еще не принята"}
                </div>
              </div>
              {deal.acceptedQuote ? (
                <Badge
                  variant={getDealQuoteStatusVariant(
                    deal.acceptedQuote.quoteStatus,
                  )}
                >
                  {getDealQuoteStatusLabel(deal.acceptedQuote.quoteStatus)}
                </Badge>
              ) : null}
            </div>
            {deal.acceptedQuote ? (
              <div className="mt-3 space-y-3">
                {acceptedQuoteDetails ? (
                  <div className="rounded-md bg-muted/40 px-3 py-3">
                    <div className="text-sm font-medium text-foreground">
                      {formatQuoteAmountsSummary(acceptedQuoteDetails)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Курс: {formatQuoteRateSummary(acceptedQuoteDetails)}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Валютная пара
                    </div>
                    <div className="text-sm font-medium">
                      {acceptedQuoteDetails
                        ? `${acceptedQuoteDetails.fromCurrency} / ${acceptedQuoteDetails.toCurrency}`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Срок действия
                    </div>
                    <div className="text-sm font-medium">
                      {deal.acceptedQuote.expiresAt
                        ? formatDate(deal.acceptedQuote.expiresAt)
                        : "Без срока"}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      Использование
                    </div>
                    <div className="text-sm font-medium">
                      {deal.acceptedQuote.usedAt
                        ? `Исполнена ${formatDate(deal.acceptedQuote.usedAt)}`
                        : "Еще не исполнена"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              История котировок
            </div>
            {quoteItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                По сделке еще нет котировок.
              </div>
            ) : (
              <div className="space-y-2">
                {quoteItems.map((quote, index) => {
                  const isAccepted = deal.acceptedQuote?.quoteId === quote.id;
                  const canAccept =
                    quote.status === "active" &&
                    !isAccepted &&
                    isAcceptingQuoteId !== quote.id;

                  return (
                    <div
                      key={quote.id}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Котировка {quoteItems.length - index}
                          </span>
                          {isAccepted ? (
                            <Badge variant="secondary">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Принята
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-sm text-foreground">
                          {formatQuoteAmountsSummary(quote)}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>{getDealQuoteStatusLabel(quote.status)}</span>
                          <span>Курс: {formatQuoteRateSummary(quote)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {quote.expiresAt
                              ? `До ${formatDate(quote.expiresAt)}`
                              : "Без срока"}
                          </span>
                          <span>Создана {formatDate(quote.createdAt)}</span>
                        </div>
                      </div>
                      {quote.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canAccept}
                          onClick={() => onAcceptQuote(quote.id)}
                        >
                          {isAcceptingQuoteId === quote.id
                            ? "Принимаем..."
                            : "Принять"}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-muted-foreground" />
            Расчет
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            disabled={
              Boolean(calculationDisabledReason) || isCreatingCalculation
            }
            onClick={onCreateCalculation}
          >
            {isCreatingCalculation ? "Создаем..." : "Создать расчет"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {calculationDisabledReason ? (
            <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {calculationDisabledReason}
            </div>
          ) : null}

          <div className="rounded-lg border p-4">
            <div className="font-medium">Текущий расчет</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {deal.summary.calculationId
                ? `Актуальная версия привязана к сделке`
                : "Расчет еще не создан"}
            </div>
            {activeCalculationQuote ? (
              <div className="mt-3 space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {formatQuoteAmountsSummary(activeCalculationQuote)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Курс: {formatQuoteRateSummary(activeCalculationQuote)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <div className="font-medium">Финансовый результат</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {deal.profitabilitySnapshot
                ? "Расчет сформирован, итоговые показатели доступны в актуальном расчете."
                : "Текущий расчет еще не сформирован."}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              История расчетов
            </div>
            {deal.calculationHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                По сделке еще нет расчетов.
              </div>
            ) : (
              <div className="space-y-2">
                {deal.calculationHistory.map((item, index) => {
                  const isActive =
                    deal.summary.calculationId === item.calculationId;
                  const sourceQuote = findQuoteDetailsById(
                    deal,
                    item.sourceQuoteId,
                  );

                  return (
                    <div
                      key={item.calculationId}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            Расчет {deal.calculationHistory.length - index}
                          </span>
                          {isActive ? (
                            <Badge variant="secondary">Актуальный</Badge>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Создан {formatDate(item.createdAt)}
                        </div>
                        {sourceQuote ? (
                          <>
                            <div className="text-sm text-foreground">
                              {formatQuoteAmountsSummary(sourceQuote)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Курс: {formatQuoteRateSummary(sourceQuote)}
                            </div>
                          </>
                        ) : item.sourceQuoteId ? (
                          <div className="text-xs text-muted-foreground">
                            Основан на котировке, курс{" "}
                            {formatMajorAmount(
                              formatRate(item.rateNum, item.rateDen),
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Курс{" "}
                            {formatMajorAmount(
                              formatRate(item.rateNum, item.rateDen),
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type DocumentsTabProps = {
  deal: FinanceDealWorkbench;
  deletingAttachmentId: string | null;
  documentsTabReturnTo: string;
  onAttachmentDelete: (attachmentId: string) => void;
  onAttachmentDownload: (attachmentId: string) => void;
  onAttachmentUpload: () => void;
};

function DocumentsTab({
  deal,
  deletingAttachmentId,
  documentsTabReturnTo,
  onAttachmentDelete,
  onAttachmentDownload,
  onAttachmentUpload,
}: DocumentsTabProps) {
  const activeRequiredDocumentIds = new Set(
    deal.formalDocumentRequirements
      .map((requirement) => requirement.activeDocumentId)
      .filter((documentId): documentId is string => Boolean(documentId)),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Что нужно приложить
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deal.attachmentRequirements.map((requirement) => (
              <div key={requirement.code} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{requirement.label}</div>
                  <span className="text-sm text-muted-foreground">
                    {getDealAttachmentRequirementStateLabel(requirement.state)}
                  </span>
                </div>
                {requirement.blockingReasons.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {requirement.blockingReasons.map((reason) => (
                      <li key={reason}>{formatDealWorkflowMessage(reason)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              Подтверждающие файлы
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={!deal.actions.canUploadAttachment}
              onClick={onAttachmentUpload}
            >
              <Upload className="mr-2 h-4 w-4" />
              Загрузить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deal.relatedResources.attachments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              По сделке пока нет загруженных вложений.
            </div>
          ) : (
            <div className="space-y-2">
              {deal.relatedResources.attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="shrink-0">
                      {getFileIcon(attachment.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {attachment.fileName}
                      </div>
                      {attachment.description ? (
                        <div className="truncate text-sm text-muted-foreground">
                          {attachment.description}
                        </div>
                      ) : null}
                      <div className="mt-1">
                        <Badge variant="outline">
                          {getAttachmentVisibilityLabel(attachment.visibility)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.fileSize)} ·{" "}
                        {formatDate(attachment.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      className="h-8 w-8 p-0"
                      size="sm"
                      title="Скачать"
                      variant="ghost"
                      onClick={() => onAttachmentDownload(attachment.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      size="sm"
                      title="Удалить"
                      variant="ghost"
                      disabled={deletingAttachmentId === attachment.id}
                      onClick={() => onAttachmentDelete(attachment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <File className="h-5 w-5 text-muted-foreground" />
            Внутренние документы
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {deal.formalDocumentRequirements.map((requirement) => {
              const createHref = requirement.createAllowed
                ? buildDocumentCreateHref(requirement.docType, {
                    dealId: deal.summary.id,
                    returnTo: documentsTabReturnTo,
                  })
                : null;
              const openHref =
                requirement.openAllowed && requirement.activeDocumentId
                  ? buildDocumentDetailsHref(
                      requirement.docType,
                      requirement.activeDocumentId,
                    )
                  : null;
              const actionHref = createHref ?? openHref;

              return (
                <div
                  key={`${requirement.stage}:${requirement.docType}`}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {getFormalDocumentLabel(requirement.docType)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getFormalDocumentStageLabel(requirement.stage)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {actionHref ? (
                        <Button
                          data-testid={`finance-deal-formal-document-action-${requirement.stage}-${requirement.docType}`}
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={actionHref} />}
                        >
                          {createHref ? "Создать" : "Открыть"}
                        </Button>
                      ) : null}
                      <Badge
                        data-testid={`finance-deal-formal-document-state-${requirement.stage}-${requirement.docType}`}
                        variant="outline"
                      >
                        {getDealFormalDocumentRequirementStateLabel(
                          requirement.state,
                        )}
                      </Badge>
                    </div>
                  </div>
                  {requirement.blockingReasons.length > 0 ? (
                    <div className="mt-2 text-sm text-muted-foreground">
                      {requirement.blockingReasons
                        .map((reason) => formatDealWorkflowMessage(reason))
                        .join(" ")}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {deal.relatedResources.formalDocuments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              По сделке еще нет формальных документов.
            </div>
          ) : (
            <div className="space-y-3">
              {deal.relatedResources.formalDocuments.map((document) => {
                const href = buildDocumentDetailsHref(
                  document.docType,
                  document.id,
                );
                const showOpenAction =
                  href !== null && !activeRequiredDocumentIds.has(document.id);

                return (
                  <div key={document.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="font-medium">
                          {getFormalDocumentLabel(document.docType)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(
                            document.createdAt ?? document.occurredAt ?? "",
                          )}
                        </div>
                      </div>
                      {showOpenAction ? (
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={href} />}
                        >
                          Открыть
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {document.submissionStatus ? (
                        <Badge variant="outline">
                          Отправка:{" "}
                          {getSubmissionStatusLabel(document.submissionStatus)}
                        </Badge>
                      ) : null}
                      {document.approvalStatus ? (
                        <Badge variant="outline">
                          Согласование:{" "}
                          {getApprovalStatusLabel(document.approvalStatus)}
                        </Badge>
                      ) : null}
                      {document.postingStatus ? (
                        <Badge variant="outline">
                          Проведение:{" "}
                          {getPostingStatusLabel(document.postingStatus)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getReconciliationStateLabel(value: string) {
  switch (value) {
    case "blocked":
      return "Есть исключения";
    case "clear":
      return "Сверка завершена";
    case "not_started":
      return "Сверка не требуется";
    case "pending":
      return "Сверка ожидается";
    default:
      return value;
  }
}

function getReconciliationStateVariant(value: string) {
  switch (value) {
    case "blocked":
      return "destructive" as const;
    case "clear":
      return "default" as const;
    case "pending":
      return "secondary" as const;
    case "not_started":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function formatProfitabilityAmounts(
  items: FinanceProfitabilityAmount[] | null | undefined,
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

type ExecutionTabProps = {
  deal: FinanceDealWorkbench;
  executionTabReturnTo: string;
  isClosingDeal: boolean;
  isCreatingLegOperationId: string | null;
  isRequestingExecution: boolean;
  isResolvingLegId: string | null;
  onCloseDeal: () => void;
  onCreateLegOperation: (legId: string) => void;
  onRequestExecution: () => void;
  onResolveLeg: (legId: string) => void;
};

function ExecutionTab({
  deal,
  executionTabReturnTo,
  isClosingDeal,
  isCreatingLegOperationId,
  isRequestingExecution,
  isResolvingLegId,
  onCloseDeal,
  onCreateLegOperation,
  onRequestExecution,
  onResolveLeg,
}: ExecutionTabProps) {
  const visiblePositions = deal.operationalState.positions.filter(
    (item) =>
      isPrimaryOperationalPositionVisible(item.kind) &&
      item.state !== "not_applicable",
  );
  const blockedPositions = visiblePositions.filter(
    (item) => item.state === "blocked",
  );
  const operationsById = new Map(
    deal.relatedResources.operations.map(
      (operation) => [operation.id, operation] as const,
    ),
  );
  const closeReadinessBlockers = deal.closeReadiness.blockers.map((blocker) =>
    formatDealWorkflowMessage(blocker),
  );
  const closeCriteria = deal.closeReadiness.criteria;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-muted-foreground" />
            Команды исполнения
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {deal.actions.canRequestExecution ? (
            <Button
              data-testid="finance-deal-request-execution"
              size="sm"
              disabled={isRequestingExecution}
              onClick={onRequestExecution}
            >
              {isRequestingExecution
                ? "Материализуем..."
                : "Запросить исполнение"}
            </Button>
          ) : null}
          {!deal.actions.canRequestExecution ? (
            <div className="text-sm text-muted-foreground">
              Дополнительные действия по инструкции доступны в карточках этапов
              и операций.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Финансовый результат и закрытие
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Комиссионный доход
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatProfitabilityAmounts(
                  deal.profitabilitySnapshot?.feeRevenue,
                )}
              </div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Доход от спреда
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatProfitabilityAmounts(
                  deal.profitabilitySnapshot?.spreadRevenue,
                )}
              </div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Расходы провайдера
              </div>
              <div className="mt-1 text-lg font-semibold">
                {formatProfitabilityAmounts(
                  deal.profitabilitySnapshot?.providerFeeExpense,
                )}
              </div>
            </div>
            <div className="rounded-lg border px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Итог по инструкциям
              </div>
              <div className="mt-1 text-lg font-semibold">
                {deal.instructionSummary.terminalOperations}/
                {deal.instructionSummary.totalOperations}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-lg border px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Результат сверки</div>
                <Badge
                  variant={getReconciliationStateVariant(
                    deal.reconciliationSummary.state,
                  )}
                >
                  {getReconciliationStateLabel(
                    deal.reconciliationSummary.state,
                  )}
                </Badge>
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Требуют сверки</span>
                  <span className="font-medium text-foreground">
                    {deal.reconciliationSummary.requiredOperationCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Связаны со сверкой</span>
                  <span className="font-medium text-foreground">
                    {deal.reconciliationSummary.reconciledOperationCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Открытых исключений</span>
                  <span className="font-medium text-foreground">
                    {deal.reconciliationSummary.openExceptionCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Закрытие сделки</div>
                {deal.actions.canCloseDeal ? (
                  <Button
                    data-testid="finance-deal-close"
                    size="sm"
                    disabled={isClosingDeal}
                    onClick={onCloseDeal}
                  >
                    {isClosingDeal ? "Закрываем..." : "Закрыть сделку"}
                  </Button>
                ) : (
                  <Badge variant="outline">Еще не готова</Badge>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {closeCriteria.map((criterion) => (
                  <div
                    key={criterion.code}
                    className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    {criterion.satisfied ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                    )}
                    <span>{criterion.label}</span>
                  </div>
                ))}
              </div>
              {!deal.actions.canCloseDeal &&
              closeReadinessBlockers.length > 0 ? (
                <div className="mt-3 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                  {closeReadinessBlockers.join(" ")}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            Исключения сверки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deal.relatedResources.reconciliationExceptions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              По связанным операциям исключений сверки пока нет.
            </div>
          ) : (
            deal.relatedResources.reconciliationExceptions.map((exception) => (
              <div
                key={`${exception.id}:${exception.operationId}`}
                className="rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={exception.blocking ? "destructive" : "outline"}
                  >
                    {exception.state === "open"
                      ? "Открыто"
                      : exception.state === "resolved"
                        ? "Разрешено"
                        : "Игнорируется"}
                  </Badge>
                  <span className="text-sm font-medium">
                    {exception.reasonCode}
                  </span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Источник: {exception.source} · Операция:{" "}
                  {exception.operationId}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Создано: {formatDate(exception.createdAt)}
                  {exception.resolvedAt
                    ? ` · Закрыто: ${formatDate(exception.resolvedAt)}`
                    : ""}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-muted-foreground" />
            Этапы исполнения
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deal.executionPlan.map((leg) => {
            const linkedOperations = leg.operationRefs
              .map((ref) => operationsById.get(ref.operationId) ?? null)
              .filter((operation) => operation !== null);
            const exchangeDocumentAction = leg.actions.exchangeDocument;
            const canResolveLegBlocker =
              deal.actions.canResolveExecutionBlocker &&
              leg.state === "blocked" &&
              Boolean(leg.id);
            const canCreateLegOperation =
              leg.actions.canCreateLegOperation && Boolean(leg.id);
            const exchangeDocumentCreateHref =
              exchangeDocumentAction?.createAllowed
                ? buildDocumentCreateHref(exchangeDocumentAction.docType, {
                    dealId: deal.summary.id,
                    returnTo: executionTabReturnTo,
                  })
                : null;
            const exchangeDocumentOpenHref =
              exchangeDocumentAction?.openAllowed &&
              exchangeDocumentAction.activeDocumentId
                ? buildDocumentDetailsHref(
                    exchangeDocumentAction.docType,
                    exchangeDocumentAction.activeDocumentId,
                  )
                : null;
            const exchangeDocumentActionHref =
              exchangeDocumentCreateHref ?? exchangeDocumentOpenHref;

            return (
              <div
                key={leg.id ?? `${leg.idx}:${leg.kind}`}
                className="rounded-lg border p-4 transition-colors hover:bg-accent/30"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {leg.idx}. {getDealLegKindLabel(leg.kind)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getDealLegStateLabel(leg.state)}
                    </div>
                    {leg.kind === "convert" && deal.pricing.fundingMessage ? (
                      <div className="text-sm text-muted-foreground">
                        {deal.pricing.fundingMessage}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      data-testid={`finance-deal-leg-state-${leg.idx}`}
                      variant="outline"
                    >
                      {getDealLegStateLabel(leg.state)}
                    </Badge>
                    {canResolveLegBlocker && leg.id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isResolvingLegId === leg.id}
                        onClick={() => onResolveLeg(leg.id!)}
                      >
                        {isResolvingLegId === leg.id
                          ? "Устраняем..."
                          : "Устранить блокер"}
                      </Button>
                    ) : null}
                    {canCreateLegOperation && leg.id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isCreatingLegOperationId === leg.id}
                        onClick={() => onCreateLegOperation(leg.id!)}
                      >
                        {isCreatingLegOperationId === leg.id
                          ? "Создаем..."
                          : "Создать операцию"}
                      </Button>
                    ) : null}
                    {exchangeDocumentActionHref ? (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={exchangeDocumentActionHref} />}
                      >
                        {exchangeDocumentCreateHref
                          ? "Создать обмен"
                          : "Открыть обмен"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {linkedOperations.length > 0 ? (
                  <div className="mt-4 grid gap-3">
                    {linkedOperations.map((operation) => (
                      <div
                        key={operation.id}
                        className="rounded-lg border bg-muted/20 px-3 py-3"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={getTreasuryOperationKindVariant(
                                  operation.kind,
                                )}
                              >
                                {getTreasuryOperationKindLabel(operation.kind)}
                              </Badge>
                              <Badge
                                variant={getTreasuryOperationInstructionStatusVariant(
                                  operation.instructionStatus,
                                )}
                              >
                                {getTreasuryOperationInstructionStatusLabel(
                                  operation.instructionStatus,
                                )}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Source ref: {operation.sourceRef}
                            </div>
                          </div>
                          <Button
                            data-testid={`finance-deal-operation-open-${operation.id}`}
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={<Link href={operation.operationHref} />}
                          >
                            Открыть операцию
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : leg.operationRefs.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    Операция привязана к этапу, но карточка операции сейчас
                    недоступна.
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Операционная готовность
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {blockedPositions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Что мешает продолжить
              </div>
              <div className="space-y-2">
                {blockedPositions.map((position) => (
                  <div
                    key={position.kind}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    {formatOperationalPositionIssue({
                      kind: position.kind,
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Критичных операционных блокеров сейчас нет.
            </div>
          )}

          {visiblePositions.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <WalletCards className="h-4 w-4" />
                Ключевые этапы движения средств
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {visiblePositions.map((position) => (
                  <div key={position.kind} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {getFinancePrimaryOperationalPositionLabel(
                          position.kind,
                        )}
                      </div>
                      <Badge
                        variant={getDealOperationalPositionStateVariant(
                          position.state,
                        )}
                      >
                        {getDealOperationalPositionStateLabel(position.state)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

type FinanceDealWorkbenchProps = {
  deal: FinanceDealWorkbench;
};

export function FinanceDealWorkbench({ deal }: FinanceDealWorkbenchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isCreatingCalculation, setIsCreatingCalculation] = useState(false);
  const [isAcceptingQuoteId, setIsAcceptingQuoteId] = useState<string | null>(
    null,
  );
  const [isClosingDeal, setIsClosingDeal] = useState(false);
  const [isCreatingLegOperationId, setIsCreatingLegOperationId] = useState<
    string | null
  >(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<
    string | null
  >(null);
  const [isRequestingExecution, setIsRequestingExecution] = useState(false);
  const [isResolvingLegId, setIsResolvingLegId] = useState<string | null>(null);

  const tabParam = searchParams.get("tab");
  const activeTab = isDealPageTab(tabParam) ? tabParam : DEFAULT_DEAL_PAGE_TAB;
  const quoteCreationDisabledReason = getQuoteCreationDisabledReason(deal);
  const calculationDisabledReason = getCalculationDisabledReason(deal);
  const workspaceTabs: EntityWorkspaceTab[] = DEAL_PAGE_TAB_META.map((tab) => ({
    id: tab.value,
    label: tab.label,
    icon: tab.icon,
    href: getDealTabHref(pathname, searchParams, tab.value),
  }));
  const title = getFinanceDealDisplayTitle({
    applicantDisplayName: deal.summary.applicantDisplayName,
    id: deal.summary.id,
    type: deal.summary.type,
  });
  const documentsTabReturnTo = getDealTabHref(
    pathname,
    searchParams,
    "documents",
  );
  const executionTabReturnTo = getDealTabHref(
    pathname,
    searchParams,
    "execution",
  );

  async function handleAcceptQuote(quoteId: string) {
    setIsAcceptingQuoteId(quoteId);

    const result = await executeMutation({
      fallbackMessage: "Не удалось принять котировку",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(deal.summary.id)}/quotes/${encodeURIComponent(quoteId)}/accept`,
          {
            method: "POST",
            credentials: "include",
          },
        ),
    });

    setIsAcceptingQuoteId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Котировка принята");
    refreshPage(router);
  }

  async function handleCreateCalculation() {
    if (!deal.acceptedQuote) {
      toast.error("Сначала примите котировку");
      return;
    }

    setIsCreatingCalculation(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось создать расчет",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(deal.summary.id)}/calculations/from-quote`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({
              quoteId: deal.acceptedQuote?.quoteId,
            }),
          },
        ),
    });

    setIsCreatingCalculation(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Расчет создан");
    refreshPage(router);
  }

  async function handleDeleteAttachment(attachmentId: string) {
    setDeletingAttachmentId(attachmentId);

    const result = await executeMutation({
      fallbackMessage: "Не удалось удалить вложение",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(deal.summary.id)}/attachments/${encodeURIComponent(attachmentId)}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        ),
    });

    setDeletingAttachmentId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Вложение удалено");
    refreshPage(router);
  }

  function handleDownloadAttachment(attachmentId: string) {
    window.open(
      `/v1/deals/${encodeURIComponent(deal.summary.id)}/attachments/${encodeURIComponent(attachmentId)}/download`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function handleRequestExecution() {
    setIsRequestingExecution(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось запросить исполнение",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(deal.summary.id)}/execution/request`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({}),
          },
        ),
    });

    setIsRequestingExecution(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Исполнение запрошено");
    refreshPage(router);
  }

  async function handleCreateLegOperation(legId: string) {
    setIsCreatingLegOperationId(legId);

    const result = await executeMutation({
      fallbackMessage: "Не удалось создать операцию по этапу",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(deal.summary.id)}/execution/legs/${encodeURIComponent(legId)}/operation`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({}),
          },
        ),
    });

    setIsCreatingLegOperationId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Операция по этапу создана");
    refreshPage(router);
  }

  async function handleResolveLeg(legId: string) {
    setIsResolvingLegId(legId);

    const result = await executeMutation({
      fallbackMessage: "Не удалось устранить блокер этапа",
      request: () =>
        fetch(
          `/v1/deals/${encodeURIComponent(deal.summary.id)}/execution/blockers/resolve`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": createIdempotencyKey(),
            },
            body: JSON.stringify({
              legId,
            }),
          },
        ),
    });

    setIsResolvingLegId(null);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Блокер этапа устранен");
    refreshPage(router);
  }

  async function handleCloseDeal() {
    setIsClosingDeal(true);

    const result = await executeMutation({
      fallbackMessage: "Не удалось закрыть сделку",
      request: () =>
        fetch(`/v1/deals/${encodeURIComponent(deal.summary.id)}/close`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          body: JSON.stringify({}),
        }),
    });

    setIsClosingDeal(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Сделка закрыта");
    refreshPage(router);
  }

  return (
    <>
      <FinanceDealWorkspaceLayout title={title}>
        <div className="space-y-6">
          <DealExecutionHeaderSummary deal={deal} />
          <EntityWorkspaceTabs value={activeTab} tabs={workspaceTabs} />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <div className="space-y-6">
              {activeTab === "overview" ? <OverviewTab deal={deal} /> : null}
              {activeTab === "pricing" ? (
                <PricingTab
                  calculationDisabledReason={calculationDisabledReason}
                  deal={deal}
                  isAcceptingQuoteId={isAcceptingQuoteId}
                  isCreatingCalculation={isCreatingCalculation}
                  onAcceptQuote={handleAcceptQuote}
                  onCreateCalculation={handleCreateCalculation}
                  onOpenQuoteDialog={() => setIsQuoteDialogOpen(true)}
                  quoteCreationDisabledReason={quoteCreationDisabledReason}
                />
              ) : null}
              {activeTab === "documents" ? (
                <DocumentsTab
                  deal={deal}
                  deletingAttachmentId={deletingAttachmentId}
                  documentsTabReturnTo={documentsTabReturnTo}
                  onAttachmentDelete={handleDeleteAttachment}
                  onAttachmentDownload={handleDownloadAttachment}
                  onAttachmentUpload={() => setIsUploadDialogOpen(true)}
                />
              ) : null}
              {activeTab === "execution" ? (
                <ExecutionTab
                  deal={deal}
                  executionTabReturnTo={executionTabReturnTo}
                  isClosingDeal={isClosingDeal}
                  isCreatingLegOperationId={isCreatingLegOperationId}
                  isRequestingExecution={isRequestingExecution}
                  isResolvingLegId={isResolvingLegId}
                  onCloseDeal={handleCloseDeal}
                  onCreateLegOperation={handleCreateLegOperation}
                  onRequestExecution={handleRequestExecution}
                  onResolveLeg={handleResolveLeg}
                />
              ) : null}
            </div>

            <div className="space-y-6">
              <ExecutionSummaryRail deal={deal} />

              <DealTimelineCard timeline={deal.timeline} maxItems={8} />

              {activeTab !== "overview" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Контекст сделки</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DealContextContent deal={deal} />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </FinanceDealWorkspaceLayout>

      <QuoteRequestDialog
        dealId={deal.summary.id}
        disabledReason={quoteCreationDisabledReason}
        open={isQuoteDialogOpen}
        quoteAmount={deal.pricing.quoteAmount}
        quoteAmountSide={deal.pricing.quoteAmountSide}
        sourceCurrencyId={deal.pricing.sourceCurrencyId}
        targetCurrencyId={deal.pricing.targetCurrencyId}
        onOpenChange={setIsQuoteDialogOpen}
        onSuccess={() => refreshPage(router)}
      />

      <UploadAttachmentDialog
        dealId={deal.summary.id}
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onSuccess={() => refreshPage(router)}
      />
    </>
  );
}
