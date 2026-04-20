"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";

import { Badge } from "@bedrock/sdk-ui/components/badge";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import { API_BASE_URL } from "@/lib/constants";
import { DEAL_QUOTE_STATUS_LABELS } from "./constants";
import { DealPricingDetailsSheet } from "./deal-pricing-details-sheet";
import { FinancialCard } from "./financial-card";
import {
  decimalToMinorString,
  formatCurrency,
  formatDate,
  formatDateTimeInput,
  minorToDecimalString,
  rationalToDecimalString,
} from "./format";
import type {
  ApiDealAcceptedQuote,
  ApiDealFundingAdjustment,
  ApiDealPricingBenchmarks,
  ApiDealPricingContext,
  ApiDealPricingFormulaTrace,
  ApiDealPricingProfitability,
  ApiDealPricingQuote,
  ApiDealPricingQuoteResult,
  ApiDealPricingRateSnapshot,
  ApiDealPricingRouteCandidate,
  ApiCurrencyOption,
  CalculationHistoryView,
  CalculationView,
} from "./types";
import { useDealPricingAutoSync } from "./use-deal-pricing-auto-sync";

type DealPricingTabProps = {
  acceptedQuote: ApiDealAcceptedQuote;
  activeCalculationId: string | null;
  amountCurrencyCode: string | null;
  amountCurrencyPrecision: number;
  calculation: CalculationView | null;
  calculationDisabledReason: string | null;
  calculationHistory: CalculationHistoryView[];
  dealId: string;
  initialRequestedAmount: string;
  isAcceptingQuoteId: string | null;
  isCreatingCalculation: boolean;
  onAcceptQuote: (quoteId: string) => void;
  onCreateCalculation: () => void;
  onError: (
    title: string,
    message: string,
    variant?: "default" | "destructive",
  ) => void;
  onReload: () => Promise<void>;
  pricingContext: ApiDealPricingContext;
  quoteAmountSide: "source" | "target";
  quoteCreationDisabledReason: string | null;
  quotes: ApiDealPricingQuote[];
  targetCurrencyCode: string | null;
  targetCurrencyPrecision: number;
  currencyOptions: ApiCurrencyOption[];
};

type StoredPricingSnapshot = {
  benchmarks: ApiDealPricingBenchmarks | null;
  formulaTrace: ApiDealPricingFormulaTrace | null;
  profitability: ApiDealPricingProfitability | null;
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

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    let message = `Ошибка запроса: ${response.status}`;

    try {
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };
      message = payload.message ?? payload.error ?? message;
    } catch {
      // Ignore JSON parsing issues.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

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

function formatQuoteStatus(status: string) {
  return DEAL_QUOTE_STATUS_LABELS[status] ?? status;
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

function formatAmountSideLabel(amountSide: "source" | "target") {
  return amountSide === "source"
    ? "сумма, которую платит клиент"
    : "сумма, которую получает клиент";
}

function cloneCommercialDraft(context: ApiDealPricingContext) {
  return {
    fixedFeeAmount: context.commercialDraft.fixedFeeAmount ?? null,
    fixedFeeCurrency: context.commercialDraft.fixedFeeCurrency ?? null,
    quoteMarkupPercent: context.commercialDraft.quoteMarkupPercent ?? null,
  };
}

function cloneFundingAdjustments(context: ApiDealPricingContext) {
  return context.fundingAdjustments.map((adjustment) => ({
    ...adjustment,
  }));
}

function summarizeRouteExpenses(
  routeAttachment: ApiDealPricingContext["routeAttachment"],
) {
  const route = routeAttachment?.snapshot;

  if (!route) {
    return { charged: 0, internal: 0, total: 0 };
  }

  const fees = [
    ...route.additionalFees,
    ...route.legs.flatMap((leg) => leg.fees ?? []),
  ];
  const charged = fees.filter((fee) => fee.chargeToCustomer).length;

  return {
    charged,
    internal: fees.length - charged,
    total: fees.length,
  };
}

function buildDefaultFundingAdjustment(
  currencyOptions: ApiCurrencyOption[],
): ApiDealFundingAdjustment {
  return {
    amountMinor: "0",
    currencyId: currencyOptions[0]?.id ?? "",
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `adj-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: "manual_offset",
    label: "Новая строка",
  };
}

function formatRateDirection(
  snapshot: ApiDealPricingRateSnapshot,
  direction: "primary" | "secondary",
) {
  if (direction === "primary") {
    return `1 ${snapshot.quoteCurrency} = ${rationalToDecimalString(snapshot.rateDen, snapshot.rateNum)} ${snapshot.baseCurrency}`;
  }

  return `1 ${snapshot.baseCurrency} = ${rationalToDecimalString(snapshot.rateNum, snapshot.rateDen)} ${snapshot.quoteCurrency}`;
}

function formatRateCardTitle(
  label: string,
  snapshot: ApiDealPricingRateSnapshot,
) {
  return `${label} ${snapshot.quoteCurrency}/${snapshot.baseCurrency}`;
}

function formatMinorAmount(amountMinor: string, currency: string) {
  return formatCurrency(
    minorToDecimalString(amountMinor, getCurrencyPrecision(currency)),
    currency,
  );
}

function buildRoutePath(
  context: ApiDealPricingContext,
  currencyCodeById: Map<string, string>,
) {
  const route = context.routeAttachment?.snapshot;

  if (!route) {
    return "Маршрут не выбран";
  }

  const chain = [
    route.currencyInId,
    ...route.legs.map((leg) => leg.toCurrencyId),
  ].map((currencyId) => currencyCodeById.get(currencyId) ?? currencyId);

  return chain.join(" → ");
}

function extractStoredPricingSnapshot(
  quote: ApiDealPricingQuote | null,
): StoredPricingSnapshot | null {
  if (!quote) {
    return null;
  }

  const metadata =
    quote.pricingTrace &&
    typeof quote.pricingTrace === "object" &&
    !Array.isArray(quote.pricingTrace) &&
    quote.pricingTrace.metadata &&
    typeof quote.pricingTrace.metadata === "object" &&
    !Array.isArray(quote.pricingTrace.metadata)
      ? (quote.pricingTrace.metadata as Record<string, unknown>)
      : null;

  const snapshot =
    metadata?.crmPricingSnapshot &&
    typeof metadata.crmPricingSnapshot === "object" &&
    !Array.isArray(metadata.crmPricingSnapshot)
      ? (metadata.crmPricingSnapshot as Record<string, unknown>)
      : null;

  if (!snapshot) {
    return null;
  }

  return {
    benchmarks:
      (snapshot.benchmarks as ApiDealPricingBenchmarks | null | undefined) ?? null,
    formulaTrace:
      (snapshot.formulaTrace as ApiDealPricingFormulaTrace | null | undefined) ??
      null,
    profitability:
      (snapshot.profitability as ApiDealPricingProfitability | null | undefined) ??
      null,
  };
}

function getFinanceRouteUrl(templateId: string | null) {
  if (!templateId || typeof window === "undefined") {
    return null;
  }

  return `${window.location.protocol}//${window.location.hostname}:3001/routes/constructor/${templateId}`;
}

function PricingRateCard({
  label,
  snapshot,
}: {
  label: string;
  snapshot: ApiDealPricingRateSnapshot;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-3">
      <div className="text-xs text-muted-foreground">
        {formatRateCardTitle(label, snapshot)}
      </div>
      <div className="mt-1 text-sm font-medium">
        {formatRateDirection(snapshot, "primary")}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatRateDirection(snapshot, "secondary")}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {snapshot.sourceLabel ?? "Без подписи"} · {formatDate(snapshot.asOf)}
      </div>
    </div>
  );
}

function PricingMetricCard({
  label,
  sublabel,
  value,
}: {
  label: string;
  sublabel?: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
      {sublabel ? (
        <div className="mt-1 text-[11px] text-muted-foreground">{sublabel}</div>
      ) : null}
    </div>
  );
}

export function DealPricingTab({
  acceptedQuote,
  activeCalculationId,
  amountCurrencyCode,
  amountCurrencyPrecision,
  calculation,
  calculationDisabledReason,
  calculationHistory,
  dealId,
  initialRequestedAmount,
  isAcceptingQuoteId,
  isCreatingCalculation,
  onAcceptQuote,
  onCreateCalculation,
  onError,
  onReload,
  pricingContext,
  quoteAmountSide,
  quoteCreationDisabledReason,
  quotes,
  targetCurrencyCode,
  targetCurrencyPrecision,
  currencyOptions,
}: DealPricingTabProps) {
  const [serverContext, setServerContext] = useState(pricingContext);
  const [commercialDraft, setCommercialDraft] = useState(() =>
    cloneCommercialDraft(pricingContext),
  );
  const [fundingAdjustments, setFundingAdjustments] = useState(() =>
    cloneFundingAdjustments(pricingContext),
  );
  const [routeCandidates, setRouteCandidates] = useState<
    ApiDealPricingRouteCandidate[]
  >([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [amountInput, setAmountInput] = useState(initialRequestedAmount);
  const [asOfInput, setAsOfInput] = useState(formatDateTimeInput(new Date()));
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [isAttachingRoute, setIsAttachingRoute] = useState(false);
  const [isDetachingRoute, setIsDetachingRoute] = useState(false);
  const [routeSyncNonce, setRouteSyncNonce] = useState(0);

  useEffect(() => {
    setServerContext(pricingContext);
    setCommercialDraft(cloneCommercialDraft(pricingContext));
    setFundingAdjustments(cloneFundingAdjustments(pricingContext));
  }, [pricingContext]);

  useEffect(() => {
    setAmountInput(initialRequestedAmount);
  }, [initialRequestedAmount]);

  useEffect(() => {
    let cancelled = false;

    async function loadRouteCandidates() {
      try {
        setIsLoadingRoutes(true);
        const nextCandidates = await fetchJson<ApiDealPricingRouteCandidate[]>(
          `${API_BASE_URL}/deals/${dealId}/pricing/routes`,
        );

        if (!cancelled) {
          setRouteCandidates(nextCandidates);
          setSelectedRouteId((current) => {
            if (serverContext.routeAttachment?.templateId) {
              return serverContext.routeAttachment.templateId;
            }

            return current || nextCandidates[0]?.id || "";
          });
        }
      } catch (error) {
        if (!cancelled) {
          onError(
            "Ошибка маршрутов",
            error instanceof Error
              ? error.message
              : "Не удалось загрузить рекомендованные маршруты.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRoutes(false);
        }
      }
    }

    void loadRouteCandidates();

    return () => {
      cancelled = true;
    };
  }, [dealId, onError, serverContext.routeAttachment?.templateId]);

  const currencyCodeById = useMemo(
    () => new Map(currencyOptions.map((currency) => [currency.id, currency.code])),
    [currencyOptions],
  );

  const amountInputPrecision =
    quoteAmountSide === "source"
      ? amountCurrencyPrecision
      : targetCurrencyPrecision;
  const amountInputCurrencyCode =
    quoteAmountSide === "source" ? amountCurrencyCode : targetCurrencyCode;
  const routeAttachmentKey = useMemo(
    () => JSON.stringify(serverContext.routeAttachment?.snapshot ?? null),
    [serverContext.routeAttachment],
  );
  const {
    autoSyncError,
    flushSync,
    isAutoSyncing,
    lastSyncedAt,
    preview,
    requestImmediateSync,
    retrySync,
    setPreview,
  } = useDealPricingAutoSync({
    amountInput,
    amountInputPrecision,
    amountSide: quoteAmountSide,
    asOfInput,
    commercialDraft,
    dealId,
    fundingAdjustments,
    onContextSynced: setServerContext,
    quoteCreationDisabledReason,
    routeAttachmentKey,
    serverContext,
  });
  const acceptedDetailedQuote = acceptedQuote
    ? (quotes.find((quote) => quote.id === acceptedQuote.quoteId) ?? null)
    : null;
  const acceptedDetailedQuoteSnapshot =
    extractStoredPricingSnapshot(acceptedDetailedQuote);
  const previewSnapshot = preview
    ? {
        benchmarks: preview.benchmarks,
        formulaTrace: preview.formulaTrace,
        profitability: preview.profitability,
      }
    : null;
  const previewOrAcceptedSnapshot =
    previewSnapshot ??
    (lastSyncedAt ? null : acceptedDetailedQuoteSnapshot);

  function applyServerContext(nextContext: ApiDealPricingContext) {
    setServerContext(nextContext);
    setCommercialDraft(cloneCommercialDraft(nextContext));
    setFundingAdjustments(cloneFundingAdjustments(nextContext));
  }

  const handleAttachRoute = async () => {
    if (!selectedRouteId) {
      onError("Маршрут не выбран", "Выберите маршрут для расчета сделки.");
      return;
    }

    try {
      setIsAttachingRoute(true);
      await flushSync().catch(() => null);
      const nextContext = await fetchJson<ApiDealPricingContext>(
        `${API_BASE_URL}/deals/${dealId}/pricing/route/attach`,
        {
          body: JSON.stringify({ routeTemplateId: selectedRouteId }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );

      applyServerContext(nextContext);
      setRouteSyncNonce((current) => current + 1);
    } catch (error) {
      onError(
        "Ошибка выбора маршрута",
        error instanceof Error
          ? error.message
          : "Не удалось выбрать маршрут.",
      );
    } finally {
      setIsAttachingRoute(false);
    }
  };

  const handleDetachRoute = async () => {
    try {
      setIsDetachingRoute(true);
      await flushSync().catch(() => null);
      const nextContext = await fetchJson<ApiDealPricingContext>(
        `${API_BASE_URL}/deals/${dealId}/pricing/route`,
        {
          method: "DELETE",
        },
      );

      applyServerContext(nextContext);
      setRouteSyncNonce((current) => current + 1);
    } catch (error) {
      onError(
        "Ошибка удаления маршрута",
        error instanceof Error
          ? error.message
          : "Не удалось убрать маршрут.",
      );
    } finally {
      setIsDetachingRoute(false);
    }
  };

  const handleCreateQuote = async () => {
    if (quoteCreationDisabledReason) {
      onError("Котировка недоступна", quoteCreationDisabledReason);
      return;
    }

    const amountMinor = decimalToMinorString(amountInput, amountInputPrecision);
    if (!amountMinor || amountMinor === "0") {
      onError(
        "Некорректная сумма",
        "Укажите сумму в корректном формате и больше нуля.",
      );
      return;
    }

    try {
      setIsCreatingQuote(true);
      const synced = await flushSync();
      const context = synced?.context;

      if (!context) {
        onError(
          "Ошибка создания котировки",
          autoSyncError ?? "Не удалось подготовить расчет для котировки.",
        );
        return;
      }

      await fetchJson<ApiDealPricingQuoteResult>(
        `${API_BASE_URL}/deals/${dealId}/pricing/quotes`,
        {
          body: JSON.stringify({
            amountMinor,
            amountSide: quoteAmountSide,
            asOf: new Date(asOfInput).toISOString(),
            expectedRevision: context.revision,
          }),
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey(),
          },
          method: "POST",
        },
      );

      setPreview(null);
      await onReload();
    } catch (error) {
      onError(
        "Ошибка создания котировки",
        error instanceof Error
          ? error.message
          : "Не удалось создать котировку.",
      );
    } finally {
      setIsCreatingQuote(false);
    }
  };

  const handleFundingAdjustmentChange = (
    index: number,
    patch: Partial<ApiDealFundingAdjustment>,
  ) => {
    setFundingAdjustments((current) =>
      current.map((adjustment, currentIndex) =>
        currentIndex === index ? { ...adjustment, ...patch } : adjustment,
      ),
    );
  };

  const handleAddFundingAdjustment = () => {
    setFundingAdjustments((current) => [
      ...current,
      buildDefaultFundingAdjustment(currencyOptions),
    ]);
  };

  const handleRemoveFundingAdjustment = (index: number) => {
    setFundingAdjustments((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const routeAttachment = serverContext.routeAttachment;
  const financeRouteUrl = getFinanceRouteUrl(routeAttachment?.templateId ?? null);
  const routeExpenseSummary = summarizeRouteExpenses(routeAttachment);

  useEffect(() => {
    if (routeSyncNonce > 0) {
      requestImmediateSync();
    }
  }, [requestImmediateSync, routeSyncNonce]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Цена и исполнение сделки
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            {isAutoSyncing ? (
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Обновляем расчет…
              </div>
            ) : lastSyncedAt ? (
              <div className="text-xs text-muted-foreground">
                Расчет обновлен {formatDate(lastSyncedAt)}
              </div>
            ) : null}
            <Button
              data-testid="deal-request-quote-button"
              disabled={Boolean(quoteCreationDisabledReason) || isCreatingQuote}
              onClick={() => void handleCreateQuote()}
              size="sm"
            >
              {isCreatingQuote ? "Создаем..." : "Создать котировку"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {quoteCreationDisabledReason ? (
            <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {quoteCreationDisabledReason}
            </div>
          ) : null}

          {autoSyncError ? (
            <div className="flex flex-col gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">Не удалось обновить расчет</div>
                <div className="text-xs text-amber-900/80">{autoSyncError}</div>
              </div>
              <Button onClick={retrySync} size="sm" variant="outline">
                Повторить
              </Button>
            </div>
          ) : null}

          {!routeAttachment ? (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Маршрут не выбран. Для расчета будет использован автоподбор по
              курсам.
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Маршрут платежа</div>
                    <div className="text-sm text-muted-foreground">
                      {routeAttachment
                        ? routeAttachment.templateName
                        : "Маршрут еще не выбран"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <div className="space-y-2">
                    <Label>Доступные маршруты</Label>
                    <Select
                      onValueChange={(value) => setSelectedRouteId(value ?? "")}
                      value={selectedRouteId}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            isLoadingRoutes ? "Загрузка..." : "Выберите маршрут"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {routeCandidates.map((route) => (
                          <SelectItem key={route.id} value={route.id}>
                            {route.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isLoadingRoutes && routeCandidates.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Подходящих маршрутов для этой сделки пока нет.
                      </div>
                    ) : null}
                  </div>
                  <Button
                    disabled={!selectedRouteId || isAttachingRoute}
                    onClick={() => void handleAttachRoute()}
                    variant="outline"
                  >
                    {isAttachingRoute ? "Применяем..." : "Выбрать маршрут"}
                  </Button>
                  <Button
                    disabled={!routeAttachment || isDetachingRoute}
                    onClick={() => void handleDetachRoute()}
                    variant="ghost"
                  >
                    {isDetachingRoute ? "Убираем..." : "Убрать маршрут"}
                  </Button>
                </div>

                {routeAttachment ? (
                  <div className="mt-4 space-y-3 rounded-md bg-muted/20 p-3">
                    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          Путь маршрута
                        </div>
                        <div className="mt-1 truncate text-sm font-medium">
                          {buildRoutePath(serverContext, currencyCodeById)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Расходы по маршруту
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {routeExpenseSummary.total === 0 ? (
                            <Badge variant="outline">Без дополнительных расходов</Badge>
                          ) : (
                            <>
                              {routeExpenseSummary.charged > 0 ? (
                                <Badge variant="secondary">
                                  {routeExpenseSummary.charged} в цене клиента
                                </Badge>
                              ) : null}
                              {routeExpenseSummary.internal > 0 ? (
                                <Badge variant="outline">
                                  {routeExpenseSummary.internal} наш расход
                                </Badge>
                              ) : null}
                            </>
                          )}
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
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-3 text-sm font-medium">Цена клиенту</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Сумма ({amountInputCurrencyCode ?? "валюта не определена"})
                    </Label>
                    <Input
                      onChange={(event) => setAmountInput(event.target.value)}
                      value={amountInput}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Курс на дату и время</Label>
                    <Input
                      onChange={(event) => setAsOfInput(event.target.value)}
                      type="datetime-local"
                      value={asOfInput}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Наценка к курсу, %</Label>
                    <Input
                      onChange={(event) =>
                        setCommercialDraft((current) => ({
                          ...current,
                          quoteMarkupPercent: event.target.value || null,
                        }))
                      }
                      placeholder="0.25"
                      value={commercialDraft.quoteMarkupPercent ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Фиксированная комиссия</Label>
                    <Input
                      onChange={(event) =>
                        setCommercialDraft((current) => ({
                          ...current,
                          fixedFeeAmount: event.target.value || null,
                        }))
                      }
                      placeholder="0.00"
                      value={commercialDraft.fixedFeeAmount ?? ""}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Валюта фиксированной комиссии</Label>
                    <Select
                      onValueChange={(value) =>
                        setCommercialDraft((current) => ({
                          ...current,
                          fixedFeeCurrency:
                            !value || value === "__none__" ? null : value,
                        }))
                      }
                      value={commercialDraft.fixedFeeCurrency ?? "__none__"}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Не выбрано" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Нет</SelectItem>
                        {currencyOptions.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Расчет ведется от значения: {formatAmountSideLabel(quoteAmountSide)}.
                  Новая котировка пересчитывается автоматически.
                </div>

                {preview ? (
                  <div className="mt-4 rounded-md bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Сумма сделки</div>
                    <div className="mt-1 text-sm font-medium">
                      {preview.quotePreview.fromAmount} {preview.quotePreview.fromCurrency} →{" "}
                      {preview.quotePreview.toAmount} {preview.quotePreview.toCurrency}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Ключевые показатели</div>
                  <Button
                    onClick={() => setIsDetailsOpen(true)}
                    size="sm"
                    variant="outline"
                  >
                    Детали расчета
                  </Button>
                </div>
                {previewOrAcceptedSnapshot?.benchmarks ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <PricingRateCard
                        label="Рынок"
                        snapshot={previewOrAcceptedSnapshot.benchmarks.market}
                      />
                      {previewOrAcceptedSnapshot.benchmarks.routeBase ? (
                        <PricingRateCard
                          label="База маршрута"
                          snapshot={previewOrAcceptedSnapshot.benchmarks.routeBase}
                        />
                      ) : null}
                      <PricingRateCard
                        label="Курс клиенту"
                        snapshot={previewOrAcceptedSnapshot.benchmarks.client}
                      />
                    </div>
                    {previewOrAcceptedSnapshot.profitability ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <PricingMetricCard
                          label="Итого клиент платит"
                          value={formatMinorAmount(
                            previewOrAcceptedSnapshot.profitability.customerTotalMinor,
                            previewOrAcceptedSnapshot.profitability.currency,
                          )}
                        />
                        <PricingMetricCard
                          label="Себестоимость"
                          value={formatMinorAmount(
                            previewOrAcceptedSnapshot.profitability.costPriceMinor,
                            previewOrAcceptedSnapshot.profitability.currency,
                          )}
                        />
                        <PricingMetricCard
                          label="Прибыль"
                          value={formatMinorAmount(
                            previewOrAcceptedSnapshot.profitability.profitMinor,
                            previewOrAcceptedSnapshot.profitability.currency,
                          )}
                        />
                        <PricingMetricCard
                          label="Маржа"
                          sublabel="на себестоимость"
                          value={`${previewOrAcceptedSnapshot.profitability.profitPercentOnCost}%`}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Укажите сумму и условия сделки. Курс, себестоимость и прибыль
                    появятся автоматически.
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Текущая принятая котировка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                {acceptedDetailedQuote ? (
                  <>
                    <div className="text-sm font-medium text-foreground">
                      {formatQuotePair(acceptedDetailedQuote, quoteAmountSide)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatQuoteAmounts(acceptedDetailedQuote)}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Котировка еще не принята.
                  </div>
                )}
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

            {acceptedDetailedQuote ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <PricingMetricCard
                  label="Курс клиенту"
                  value={formatQuoteRate(acceptedDetailedQuote, quoteAmountSide)}
                />
                <PricingMetricCard
                  label="Себестоимость"
                  value={
                    acceptedDetailedQuoteSnapshot?.profitability
                      ? formatMinorAmount(
                          acceptedDetailedQuoteSnapshot.profitability.costPriceMinor,
                          acceptedDetailedQuoteSnapshot.profitability.currency,
                        )
                      : "—"
                  }
                />
                <PricingMetricCard
                  label="Прибыль"
                  value={
                    acceptedDetailedQuoteSnapshot?.profitability
                      ? formatMinorAmount(
                          acceptedDetailedQuoteSnapshot.profitability.profitMinor,
                          acceptedDetailedQuoteSnapshot.profitability.currency,
                        )
                      : "—"
                  }
                />
              </div>
            ) : null}
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

      <DealPricingDetailsSheet
        acceptedQuoteId={acceptedQuote?.quoteId ?? null}
        currencyCodeById={currencyCodeById}
        currencyOptions={currencyOptions}
        financeRouteUrl={financeRouteUrl}
        formulaTrace={previewOrAcceptedSnapshot?.formulaTrace ?? null}
        fundingAdjustments={fundingAdjustments}
        fundingSummary={preview?.fundingSummary ?? null}
        isAcceptingQuoteId={isAcceptingQuoteId}
        onAcceptQuote={onAcceptQuote}
        onAddFundingAdjustment={handleAddFundingAdjustment}
        onFundingAdjustmentChange={handleFundingAdjustmentChange}
        onOpenChange={setIsDetailsOpen}
        onRemoveFundingAdjustment={handleRemoveFundingAdjustment}
        open={isDetailsOpen}
        quoteAmountSide={quoteAmountSide}
        quotes={quotes}
        routeAttachment={routeAttachment}
        routePath={buildRoutePath(serverContext, currencyCodeById)}
      />
    </div>
  );
}
