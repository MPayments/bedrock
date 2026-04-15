import { CheckCircle2, Clock3, Wallet } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
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
  ApiCrmDealWorkbenchProjection,
  ApiDealPricingQuote,
} from "./types";

type DealPricingTabProps = {
  calculationDisabledReason: string | null;
  quoteAmountSide: "source" | "target";
  workbench: ApiCrmDealWorkbenchProjection;
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

function resolveAcceptedPricingQuoteId(
  workbench: ApiCrmDealWorkbenchProjection,
) {
  return (
    workbench.acceptedCalculation?.quoteProvenance?.sourceQuoteId ??
    workbench.acceptedCalculation?.quoteProvenance?.fxQuoteId ??
    null
  );
}

export function DealPricingTab({
  calculationDisabledReason,
  quoteAmountSide,
  workbench,
}: DealPricingTabProps) {
  const acceptedCalculation = workbench.acceptedCalculation;
  const activeCalculationId = workbench.summary.calculationId;
  const calculation = workbench.pricing.currentCalculation;
  const calculationHistory = workbench.pricing.calculationHistory;
  const quotes = workbench.pricing.quotes;
  const acceptedPricingQuoteId = resolveAcceptedPricingQuoteId(workbench);
  const acceptedPricingQuote = acceptedPricingQuoteId
    ? (quotes.find((quote) => quote.id === acceptedPricingQuoteId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Котировка и курс
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Работа с котировками и фиксацией расчета выполняется в Finance. В
            CRM доступен только просмотр коммерческого состояния сделки.
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-medium">Текущий зафиксированный расчет</div>
                {acceptedPricingQuote ? (
                  <>
                    <div className="text-sm font-medium text-foreground">
                      {formatQuotePair(acceptedPricingQuote, quoteAmountSide)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Поток сделки: {formatQuoteFlow(acceptedPricingQuote)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatQuoteAmounts(acceptedPricingQuote)}
                    </div>
                  </>
                ) : null}
                <div className="text-sm text-muted-foreground">
                  {acceptedCalculation
                    ? `Зафиксирован ${formatDate(acceptedCalculation.acceptedAt)}`
                    : "Расчет еще не зафиксирован"}
                </div>
              </div>
              {acceptedCalculation ? (
                <Badge variant="outline">
                  {acceptedPricingQuote
                    ? formatQuoteStatus(acceptedPricingQuote.status)
                    : "Зафиксирован"}
                </Badge>
              ) : null}
            </div>

            {acceptedCalculation ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {acceptedPricingQuote ? (
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <div className="text-xs text-muted-foreground">Курс</div>
                    <div className="text-sm font-medium">
                      {formatQuoteRate(acceptedPricingQuote, quoteAmountSide)}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Суммарная комиссия
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedPricingQuote
                      ? formatQuoteFeePercent(
                          acceptedPricingQuote.commercialTerms?.totalFeeBps,
                        )
                      : "0%"}
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Фиксированная комиссия
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedPricingQuote
                      ? formatQuoteFixedFee(acceptedPricingQuote)
                      : "Нет"}
                  </div>
                </div>
              </div>
            ) : null}
            {acceptedPricingQuote ? (
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Договорная комиссия
                  </div>
                  <div className="text-sm font-medium">
                    {formatQuoteFeePercent(
                      acceptedPricingQuote.commercialTerms?.agreementFeeBps,
                    )}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Надбавка к котировке
                  </div>
                  <div className="text-sm font-medium">
                    {formatQuoteFeePercent(
                      acceptedPricingQuote.commercialTerms?.quoteMarkupBps,
                    )}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Срок действия
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedPricingQuote.expiresAt
                      ? formatDate(acceptedPricingQuote.expiresAt)
                      : "—"}
                  </div>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    Использование
                  </div>
                  <div className="text-sm font-medium">
                    {acceptedPricingQuote.usedAt
                      ? `Исполнена ${formatDate(acceptedPricingQuote.usedAt)}`
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
                  const isAccepted = acceptedPricingQuoteId === quote.id;

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
                              В зафиксированном расчете
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
        disabledReason={
          calculationDisabledReason ??
          "Создание и фиксация расчета перенесены в Finance."
        }
        isCreating={false}
        onCreate={null}
      />
    </div>
  );
}
