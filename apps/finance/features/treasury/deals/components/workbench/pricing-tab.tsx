import { CheckCircle2, Clock3, Wallet, WalletCards } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { formatRate } from "@/features/treasury/rates/lib/format";
import {
  getDealQuoteStatusLabel,
  getDealQuoteStatusVariant,
} from "@/features/treasury/deals/labels";
import type { FinanceDealWorkbench } from "@/features/treasury/deals/lib/queries";
import { formatDate, formatMajorAmount } from "@/lib/format";

import {
  findQuoteDetailsById,
  formatQuoteAmountsSummary,
  formatQuoteRateSummary,
  getAcceptedQuoteDetails,
  getQuoteItemsForDisplay,
} from "./utils";

export type PricingTabProps = {
  calculationDisabledReason: string | null;
  deal: FinanceDealWorkbench;
  isAcceptingQuoteId: string | null;
  isCreatingCalculation: boolean;
  onAcceptQuote: (quoteId: string) => void;
  onCreateCalculation: () => void;
  onOpenQuoteDialog: () => void;
  quoteCreationDisabledReason: string | null;
};

export function PricingTab({
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
