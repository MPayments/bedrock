import { CheckCircle2, Clock3, Wallet } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";

import { DEAL_QUOTE_STATUS_LABELS } from "./constants";
import { FinancialCard } from "./financial-card";
import {
  feeBpsToPercentString,
  formatCurrency,
  formatDate,
  minorToDecimalString,
  rationalToDecimalString,
} from "./format";
import type {
  ApiDealAcceptedQuote,
  ApiDealPricingQuote,
  CalculationHistoryView,
  CalculationView,
} from "./types";

type DealPricingTabProps = {
  acceptedQuote: ApiDealAcceptedQuote;
  activeCalculationId: string | null;
  calculation: CalculationView | null;
  calculationDisabledReason: string | null;
  calculationHistory: CalculationHistoryView[];
  isAcceptingQuoteId: string | null;
  isCreatingCalculation: boolean;
  isCreatingQuote: boolean;
  onAcceptQuote: (quoteId: string) => void;
  onCreateCalculation: () => void;
  onCreateQuote: () => void;
  quoteAmountSide: "source" | "target";
  quoteCreationDisabledReason: string | null;
  quotes: ApiDealPricingQuote[];
};

function formatQuoteStatus(status: string) {
  return DEAL_QUOTE_STATUS_LABELS[status] ?? status;
}

function formatQuoteFlow(quote: ApiDealPricingQuote) {
  return `${quote.fromCurrency} → ${quote.toCurrency}`;
}

function formatQuotePair(
  quote: ApiDealPricingQuote,
  amountSide: "source" | "target",
) {
  if (amountSide === "target") {
    return `${quote.toCurrency}/${quote.fromCurrency}`;
  }

  return `${quote.fromCurrency}/${quote.toCurrency}`;
}

function getCurrencyPrecision(currencyCode: string) {
  try {
    return (
      new Intl.NumberFormat("ru-RU", {
        currency: currencyCode,
        style: "currency",
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

function formatQuoteAmounts(quote: ApiDealPricingQuote) {
  const fromAmount = minorToDecimalString(
    quote.fromAmountMinor,
    getCurrencyPrecision(quote.fromCurrency),
  );
  const toAmount = minorToDecimalString(
    quote.toAmountMinor,
    getCurrencyPrecision(quote.toCurrency),
  );

  return `${formatCurrency(fromAmount, quote.fromCurrency)} → ${formatCurrency(toAmount, quote.toCurrency)}`;
}

function formatQuoteRate(
  quote: ApiDealPricingQuote,
  amountSide: "source" | "target",
) {
  if (amountSide === "target") {
    return `1 ${quote.toCurrency} = ${rationalToDecimalString(quote.rateDen, quote.rateNum)} ${quote.fromCurrency}`;
  }

  return `1 ${quote.fromCurrency} = ${rationalToDecimalString(quote.rateNum, quote.rateDen)} ${quote.toCurrency}`;
}

function formatQuoteFeePercent(bps: string | null | undefined) {
  return `${feeBpsToPercentString(bps ?? "0")}%`;
}

function formatQuoteFixedFee(quote: ApiDealPricingQuote) {
  if (
    !quote.commercialTerms?.fixedFeeAmountMinor ||
    !quote.commercialTerms.fixedFeeCurrency
  ) {
    return "Нет";
  }

  return formatCurrency(
    minorToDecimalString(
      quote.commercialTerms.fixedFeeAmountMinor,
      getCurrencyPrecision(quote.commercialTerms.fixedFeeCurrency),
    ),
    quote.commercialTerms.fixedFeeCurrency,
  );
}

export function DealPricingTab({
  acceptedQuote,
  activeCalculationId,
  calculation,
  calculationDisabledReason,
  calculationHistory,
  isAcceptingQuoteId,
  isCreatingCalculation,
  isCreatingQuote,
  onAcceptQuote,
  onCreateCalculation,
  onCreateQuote,
  quoteAmountSide,
  quoteCreationDisabledReason,
  quotes,
}: DealPricingTabProps) {
  const acceptedDetailedQuote = acceptedQuote
    ? (quotes.find((quote) => quote.id === acceptedQuote.quoteId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Котировка и курс
          </CardTitle>
          <Button
            data-testid="deal-request-quote-button"
            disabled={Boolean(quoteCreationDisabledReason) || isCreatingQuote}
            onClick={onCreateQuote}
            size="sm"
          >
            {isCreatingQuote ? "Запрашиваем..." : "Запросить котировку"}
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
                {acceptedDetailedQuote ? (
                  <>
                    <div className="text-sm font-medium text-foreground">
                      {formatQuotePair(acceptedDetailedQuote, quoteAmountSide)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Поток сделки: {formatQuoteFlow(acceptedDetailedQuote)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatQuoteAmounts(acceptedDetailedQuote)}
                    </div>
                  </>
                ) : null}
                <div className="text-sm text-muted-foreground">
                  {acceptedQuote
                    ? `Принята ${formatDate(acceptedQuote.acceptedAt)}`
                    : "Котировка еще не принята"}
                </div>
              </div>
              {acceptedQuote ? (
                <Badge variant="outline">
                  {formatQuoteStatus(acceptedQuote.quoteStatus)}
                </Badge>
              ) : null}
            </div>

            {acceptedQuote ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {acceptedDetailedQuote ? (
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Курс</div>
                    <div className="text-sm font-medium">
                      {formatQuoteRate(acceptedDetailedQuote, quoteAmountSide)}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Суммарная комиссия
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedDetailedQuote
                      ? formatQuoteFeePercent(
                          acceptedDetailedQuote.commercialTerms?.totalFeeBps,
                        )
                      : "0%"}
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Фиксированная комиссия
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedDetailedQuote
                      ? formatQuoteFixedFee(acceptedDetailedQuote)
                      : "Нет"}
                  </div>
                </div>
              </div>
            ) : null}
            {acceptedDetailedQuote ? (
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Договорная комиссия
                  </div>
                  <div className="text-sm font-medium">
                    {formatQuoteFeePercent(
                      acceptedDetailedQuote.commercialTerms?.agreementFeeBps,
                    )}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Надбавка к котировке
                  </div>
                  <div className="text-sm font-medium">
                    {formatQuoteFeePercent(
                      acceptedDetailedQuote.commercialTerms?.quoteMarkupBps,
                    )}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Срок действия
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedQuote?.expiresAt
                      ? formatDate(acceptedQuote.expiresAt)
                      : "—"}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Использование
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedQuote?.usedAt
                      ? `Исполнена ${formatDate(acceptedQuote.usedAt)}`
                      : "Еще не исполнена"}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
              История котировок
            </div>
            {quotes.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                По сделке еще нет котировок.
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.map((quote) => {
                  const isAccepted = acceptedQuote?.quoteId === quote.id;
                  const canAccept =
                    quote.status === "active" &&
                    !isAccepted &&
                    !isCreatingQuote;

                  return (
                    <div
                      key={quote.id}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatQuotePair(quote, quoteAmountSide)}
                          </span>
                          {isAccepted ? (
                            <Badge variant="secondary">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Принята
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-sm text-foreground">
                          {formatQuoteAmounts(quote)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Поток сделки: {formatQuoteFlow(quote)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Финальный курс клиента:{" "}
                          {formatQuoteRate(quote, quoteAmountSide)}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>
                            Договорная комиссия{" "}
                            {formatQuoteFeePercent(
                              quote.commercialTerms?.agreementFeeBps,
                            )}
                          </span>
                          <span>
                            Надбавка{" "}
                            {formatQuoteFeePercent(
                              quote.commercialTerms?.quoteMarkupBps,
                            )}
                          </span>
                          <span>
                            Итого{" "}
                            {formatQuoteFeePercent(
                              quote.commercialTerms?.totalFeeBps,
                            )}
                          </span>
                          <span>
                            Фиксированная комиссия {formatQuoteFixedFee(quote)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>{formatQuoteStatus(quote.status)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {quote.expiresAt
                              ? `До ${formatDate(quote.expiresAt)}`
                              : "Без срока"}
                          </span>
                          <span>Создана {formatDate(quote.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canAccept ? (
                          <Button
                            data-testid={`deal-accept-quote-button-${quote.id}`}
                            disabled={isAcceptingQuoteId === quote.id}
                            onClick={() => onAcceptQuote(quote.id)}
                            size="sm"
                            variant="outline"
                          >
                            {isAcceptingQuoteId === quote.id
                              ? "Принимаем..."
                              : "Принять"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <FinancialCard
        activeCalculationId={activeCalculationId}
        calculation={calculation}
        calculationHistory={calculationHistory}
        disabledReason={calculationDisabledReason}
        isCreating={isCreatingCalculation}
        onCreate={onCreateCalculation}
      />
    </div>
  );
}
