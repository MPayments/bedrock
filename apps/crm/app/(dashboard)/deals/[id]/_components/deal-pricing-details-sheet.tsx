"use client";

import { CheckCircle2, Clock3, ExternalLink, Plus, Trash2 } from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@bedrock/sdk-ui/components/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@bedrock/sdk-ui/components/tabs";

import {
  decimalToMinorString,
  formatCurrency,
  formatDate,
  minorToDecimalString,
  rationalToDecimalString,
} from "./format";
import type {
  ApiDealFundingAdjustment,
  ApiDealPricingContext,
  ApiDealPricingFormulaTrace,
  ApiDealPricingPreview,
  ApiDealPricingQuote,
  ApiCurrencyOption,
  ApiPaymentRouteFee,
} from "./types";

type DealPricingDetailsSheetProps = {
  acceptedQuoteId: string | null;
  currencyCodeById: Map<string, string>;
  currencyOptions: ApiCurrencyOption[];
  financeRouteUrl: string | null;
  formulaTrace: ApiDealPricingFormulaTrace | null;
  fundingAdjustments: ApiDealFundingAdjustment[];
  fundingSummary: ApiDealPricingPreview["fundingSummary"] | null;
  isAcceptingQuoteId: string | null;
  onAcceptQuote: (quoteId: string) => void;
  onAddFundingAdjustment: () => void;
  onFundingAdjustmentChange: (
    index: number,
    patch: Partial<ApiDealFundingAdjustment>,
  ) => void;
  onOpenChange: (open: boolean) => void;
  onRemoveFundingAdjustment: (index: number) => void;
  open: boolean;
  quoteAmountSide: "source" | "target";
  quotes: ApiDealPricingQuote[];
  routeAttachment: ApiDealPricingContext["routeAttachment"];
  routePath: string;
};

const FUNDING_ADJUSTMENT_KIND_LABELS: Record<
  ApiDealFundingAdjustment["kind"],
  string
> = {
  already_funded: "Уже профинансировано",
  available_balance: "Доступный остаток",
  manual_offset: "Ручная корректировка",
  reconciliation_adjustment: "Корректировка по сверке",
};

function getCurrencyPrecision(currencyCode: string | null | undefined) {
  if (!currencyCode) {
    return 2;
  }

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

function formatQuotePair(
  quote: ApiDealPricingQuote,
  amountSide: "source" | "target",
) {
  if (amountSide === "target") {
    return `${quote.toCurrency}/${quote.fromCurrency}`;
  }

  return `${quote.fromCurrency}/${quote.toCurrency}`;
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

function formatFundingPosition(
  position: ApiDealPricingPreview["fundingSummary"]["positions"][number],
) {
  const precision = getCurrencyPrecision(position.currencyCode);

  return {
    adjustment: formatCurrency(
      minorToDecimalString(position.adjustmentTotalMinor, precision),
      position.currencyCode,
    ),
    netNeed: formatCurrency(
      minorToDecimalString(position.netFundingNeedMinor, precision),
      position.currencyCode,
    ),
    required: formatCurrency(
      minorToDecimalString(position.requiredMinor, precision),
      position.currencyCode,
    ),
  };
}

function formatRouteFeeLabel(
  fee: ApiPaymentRouteFee,
  currencyCodeById: Map<string, string>,
) {
  const label = fee.label?.trim() || "Расход";

  if (fee.kind !== "fixed") {
    return `${label} · ${fee.percentage ?? "0"}%`;
  }

  const currencyCode = fee.currencyId
    ? (currencyCodeById.get(fee.currencyId) ?? fee.currencyId)
    : null;
  const amount = fee.amountMinor
    ? minorToDecimalString(
        fee.amountMinor,
        getCurrencyPrecision(currencyCode),
      )
    : "0";

  return `${label} · ${formatCurrency(amount, currencyCode)}`;
}

export function DealPricingDetailsSheet({
  acceptedQuoteId,
  currencyCodeById,
  currencyOptions,
  financeRouteUrl,
  formulaTrace,
  fundingAdjustments,
  fundingSummary,
  isAcceptingQuoteId,
  onAcceptQuote,
  onAddFundingAdjustment,
  onFundingAdjustmentChange,
  onOpenChange,
  onRemoveFundingAdjustment,
  open,
  quoteAmountSide,
  quotes,
  routeAttachment,
  routePath,
}: DealPricingDetailsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 p-0 sm:max-w-2xl"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Детали расчета</SheetTitle>
          <SheetDescription>
            Формула, маршрут, обеспечение и история котировок.
          </SheetDescription>
        </SheetHeader>

        <Tabs className="flex h-full min-h-0 flex-1" defaultValue="route">
          <div className="border-b px-4 py-3">
            <TabsList className="w-full justify-start" variant="line">
              <TabsTrigger value="route">Маршрут</TabsTrigger>
              <TabsTrigger value="formula">Формула</TabsTrigger>
              <TabsTrigger value="funding">Обеспечение</TabsTrigger>
              <TabsTrigger value="quotes">Котировки</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent className="overflow-y-auto p-4" value="route">
            {!routeAttachment ? (
              <div className="text-sm text-muted-foreground">
                Маршрут еще не выбран.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border bg-background px-3 py-3">
                    <div className="text-xs text-muted-foreground">
                      Название маршрута
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {routeAttachment.templateName}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-3">
                    <div className="text-xs text-muted-foreground">Путь</div>
                    <div className="mt-1 text-sm font-medium">{routePath}</div>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-3">
                    <div className="text-xs text-muted-foreground">
                      Шаблон маршрута
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {routeAttachment.templateId}
                    </div>
                  </div>
                  <div className="rounded-md border bg-background px-3 py-3">
                    <div className="text-xs text-muted-foreground">
                      Маршрут привязан
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {formatDate(routeAttachment.attachedAt)}
                    </div>
                  </div>
                </div>

                {financeRouteUrl ? (
                  <Button
                    onClick={() =>
                      window.open(
                        financeRouteUrl,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Открыть шаблон в finance
                  </Button>
                ) : null}

                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Дополнительные комиссии и расходы
                  </div>
                  {routeAttachment.snapshot.additionalFees.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Дополнительных комиссий по маршруту нет.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {routeAttachment.snapshot.additionalFees.map((fee) => (
                        <div
                          key={fee.id}
                          className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <span>{formatRouteFeeLabel(fee, currencyCodeById)}</span>
                          <Badge
                            variant={fee.chargeToCustomer ? "secondary" : "outline"}
                          >
                            {fee.chargeToCustomer
                              ? "В цене клиента"
                              : "Наш расход"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Шаги маршрута
                  </div>
                  {routeAttachment.snapshot.legs.map((leg) => (
                    <div
                      key={leg.id}
                      className="rounded-md border bg-background px-3 py-3"
                    >
                      <div className="text-sm font-medium">
                        Шаг {leg.idx}:{" "}
                        {(currencyCodeById.get(leg.fromCurrencyId) ??
                          leg.fromCurrencyId) +
                          " → " +
                          (currencyCodeById.get(leg.toCurrencyId) ??
                            leg.toCurrencyId)}
                      </div>
                      {!leg.fees || leg.fees.length === 0 ? (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Расходов на этом шаге нет.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {leg.fees.map((fee) => (
                            <div
                              key={fee.id}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span>{formatRouteFeeLabel(fee, currencyCodeById)}</span>
                              <Badge
                                variant={fee.chargeToCustomer ? "secondary" : "outline"}
                              >
                                {fee.chargeToCustomer
                                  ? "В цене клиента"
                                  : "Наш расход"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent className="overflow-y-auto p-4" value="formula">
            {formulaTrace ? (
              <div className="space-y-4">
                {formulaTrace.sections.map((section) => (
                  <div key={section.kind} className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </div>
                    {section.lines.map((line, index) => (
                      <div
                        key={`${section.kind}-${index}`}
                        className="rounded-md border bg-background px-3 py-2"
                      >
                        <div className="text-xs text-muted-foreground">
                          {line.label}
                        </div>
                        <div className="mt-1 text-sm font-medium">
                          {line.expression}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {line.result}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Формула расчета появится после первого preview.
              </div>
            )}
          </TabsContent>

          <TabsContent className="overflow-y-auto p-4" value="funding">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Обеспечение сделки
                </div>
                {fundingSummary?.positions.length ? (
                  <div className="space-y-2">
                    {fundingSummary.positions.map((position) => {
                      const formatted = formatFundingPosition(position);
                      return (
                        <div
                          key={position.currencyId}
                          className="grid gap-2 rounded-md border px-3 py-2 text-sm md:grid-cols-4"
                        >
                          <div className="font-medium">{position.currencyCode}</div>
                          <div>Нужно: {formatted.required}</div>
                          <div>Корректировки: {formatted.adjustment}</div>
                          <div>Обеспечить: {formatted.netNeed}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Потребность в обеспечении появится после preview.
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Остатки и корректировки
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Эти строки влияют на обеспечение сделки.
                    </div>
                  </div>
                  <Button
                    onClick={onAddFundingAdjustment}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить строку
                  </Button>
                </div>

                {fundingAdjustments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Остатки и корректировки пока не заданы.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fundingAdjustments.map((adjustment, index) => (
                      <div
                        key={adjustment.id}
                        className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <Label>Тип строки</Label>
                          <Select
                            onValueChange={(value) =>
                              onFundingAdjustmentChange(index, {
                                kind:
                                  (value as ApiDealFundingAdjustment["kind"] | null) ??
                                  adjustment.kind,
                              })
                            }
                            value={adjustment.kind}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(
                                Object.entries(
                                  FUNDING_ADJUSTMENT_KIND_LABELS,
                                ) as Array<
                                  [ApiDealFundingAdjustment["kind"], string]
                                >
                              ).map(([kind, label]) => (
                                <SelectItem key={kind} value={kind}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Название</Label>
                          <Input
                            onChange={(event) =>
                              onFundingAdjustmentChange(index, {
                                label: event.target.value,
                              })
                            }
                            value={adjustment.label}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Валюта</Label>
                          <Select
                            onValueChange={(value) =>
                              onFundingAdjustmentChange(index, {
                                currencyId: value ?? adjustment.currencyId,
                              })
                            }
                            value={adjustment.currencyId}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {currencyOptions.map((currency) => (
                                <SelectItem key={currency.id} value={currency.id}>
                                  {currency.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Сумма</Label>
                          <Input
                            onChange={(event) => {
                              const currencyCode =
                                currencyCodeById.get(adjustment.currencyId) ?? null;
                              const precision = getCurrencyPrecision(currencyCode);
                              const minorAmount =
                                decimalToMinorString(
                                  event.target.value.replace(/^\+/u, ""),
                                  precision,
                                ) ?? "0";
                              const normalized =
                                event.target.value.trim().startsWith("-")
                                  ? `-${minorAmount}`
                                  : minorAmount;

                              onFundingAdjustmentChange(index, {
                                amountMinor: normalized,
                              });
                            }}
                            value={minorToDecimalString(
                              adjustment.amountMinor,
                              getCurrencyPrecision(
                                currencyCodeById.get(adjustment.currencyId),
                              ),
                            )}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            onClick={() => onRemoveFundingAdjustment(index)}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent className="overflow-y-auto p-4" value="quotes">
            {quotes.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                По сделке еще нет котировок.
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.map((quote) => {
                  const isAccepted = acceptedQuoteId === quote.id;
                  const canAccept = quote.status === "active" && !isAccepted;

                  return (
                    <div key={quote.id} className="rounded-lg border p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {formatQuotePair(quote, quoteAmountSide)}
                            </span>
                            {isAccepted ? (
                              <Badge variant="secondary">Принята</Badge>
                            ) : null}
                          </div>
                          <div className="text-sm text-foreground">
                            {formatQuoteAmounts(quote)}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span>Курс: {formatQuoteRate(quote, quoteAmountSide)}</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 className="h-3.5 w-3.5" />
                              До {formatDate(quote.expiresAt)}
                            </span>
                          </div>
                        </div>
                        <Button
                          disabled={!canAccept || isAcceptingQuoteId === quote.id}
                          onClick={() => onAcceptQuote(quote.id)}
                          size="sm"
                          variant="outline"
                        >
                          {isAcceptingQuoteId === quote.id ? (
                            "Принимаем..."
                          ) : isAccepted ? (
                            "Принята"
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Принять
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
