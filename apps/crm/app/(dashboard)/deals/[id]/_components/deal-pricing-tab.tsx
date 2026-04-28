"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  Wallet,
} from "lucide-react";

import { downloadPrintForm } from "@bedrock/sdk-print-forms-ui/lib/client";
import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Input } from "@bedrock/sdk-ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
} from "@bedrock/sdk-ui/components/input-group";
import { Label } from "@bedrock/sdk-ui/components/label";
import { toast } from "@bedrock/sdk-ui/components/sonner";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import { API_BASE_URL } from "@/lib/constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";

import {
  decimalToMinorString,
  formatCurrency,
  formatDate,
  formatDateTimeInput,
  formatSignedPercentVsRate,
  minorToDecimalString,
  rationalToDecimalString,
} from "./format";
import { RoutePreview } from "./route-preview";
import type {
  ApiDealAcceptedQuote,
  ApiDealPricingBenchmarks,
  ApiDealPricingContext,
  ApiDealPricingFormulaTrace,
  ApiDealPricingPreview,
  ApiDealPricingProfitability,
  ApiDealPricingQuote,
  ApiDealPricingQuoteResult,
  ApiDealQuoteAcceptanceHistoryItem,
  ApiCurrencyOption,
} from "./types";
import { useDealPricingAutoSync } from "./use-deal-pricing-auto-sync";

type DealPricingTabProps = {
  acceptedQuote: ApiDealAcceptedQuote;
  amountCurrencyPrecision: number;
  currentCalculationId: string | null;
  dealId: string;
  fundingDeadline: string | null;
  initialRequestedAmount: string;
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
  targetCurrencyPrecision: number;
  currencyOptions: ApiCurrencyOption[];
};

type StoredPricingSnapshot = {
  benchmarks: ApiDealPricingBenchmarks | null;
  formulaTrace: ApiDealPricingFormulaTrace | null;
  profitability: ApiDealPricingProfitability | null;
};

type ApiTreasuryInventoryPosition = {
  acquiredAmountMinor: string;
  availableAmountMinor: string;
  costAmountMinor: string;
  costCurrencyId: string;
  currencyId: string;
  id: string;
  ownerPartyId: string;
  ownerRequisiteId: string | null;
  sourceOrderId: string;
  state: "open" | "exhausted" | "cancelled";
};

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    init: { status: number; code?: string; details?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    let message = `Ошибка запроса: ${response.status}`;
    let code: string | undefined;
    let details: unknown;

    try {
      const payload = (await response.json()) as {
        code?: string;
        details?: unknown;
        error?: string;
        message?: string;
      };
      message = payload.message ?? payload.error ?? message;
      code = payload.code;
      details = payload.details;
    } catch {
      // Ignore JSON parsing issues.
    }

    throw new ApiError(message, { code, details, status: response.status });
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

function cloneCommercialDraft(context: ApiDealPricingContext) {
  return {
    clientPricing: context.commercialDraft.clientPricing ?? null,
    executionSource: context.commercialDraft.executionSource ?? {
      type: "route_execution" as const,
    },
    fixedFeeAmount: context.commercialDraft.fixedFeeAmount ?? null,
    fixedFeeCurrency: context.commercialDraft.fixedFeeCurrency ?? null,
    quoteMarkupBps: context.commercialDraft.quoteMarkupBps ?? null,
  };
}

function cloneFundingAdjustments(context: ApiDealPricingContext) {
  return context.fundingAdjustments.map((adjustment) => ({
    ...adjustment,
  }));
}

function decimalRateToFraction(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^(0|[1-9]\d*)(?:\.\d+)?$/u.test(normalized)) {
    return null;
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const scale = 100_000_000n;
  const trimmedFraction = fraction.slice(0, 8).padEnd(8, "0");
  const rateDen = BigInt(whole) * scale + BigInt(trimmedFraction || "0");
  if (rateDen <= 0n) return null;
  return {
    rateDen: rateDen.toString(),
    rateNum: scale.toString(),
  };
}

function fractionRateToDecimal(
  rate: { rateDen: string; rateNum: string } | null,
) {
  if (!rate) return "";
  return rationalToDecimalString(rate.rateDen, rate.rateNum, 6);
}

function defaultClientPricing() {
  return {
    clientRate: null,
    clientTotalMinor: null,
    commercialFeeCurrency: null,
    commercialFeeMinor: null,
    discountCurrency: null,
    discountMinor: null,
    mode: "client_rate" as const,
    passThroughPolicy: "none" as const,
  };
}

function formatMinorAmount(amountMinor: string, currency: string) {
  return formatCurrency(
    minorToDecimalString(amountMinor, getCurrencyPrecision(currency)),
    currency,
  );
}

function formatInventoryPositionLabel(
  position: ApiTreasuryInventoryPosition,
  currencyCodeById: Map<string, string>,
) {
  const currency = currencyCodeById.get(position.currencyId) ?? position.currencyId;
  const costCurrency =
    currencyCodeById.get(position.costCurrencyId) ?? position.costCurrencyId;
  const costRate = rationalToDecimalString(
    position.costAmountMinor,
    position.acquiredAmountMinor,
    6,
  );
  return `${formatMinorAmount(position.availableAmountMinor, currency)} доступно · себес 1 ${currency} = ${costRate} ${costCurrency} · ордер #${position.sourceOrderId.slice(0, 8)}`;
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

  const nestedSnapshot =
    metadata?.crmPricingSnapshot &&
    typeof metadata.crmPricingSnapshot === "object" &&
    !Array.isArray(metadata.crmPricingSnapshot)
      ? (metadata.crmPricingSnapshot as Record<string, unknown>)
      : null;

  const benchmarks =
    (nestedSnapshot?.benchmarks as
      | ApiDealPricingBenchmarks
      | null
      | undefined) ??
    quote.benchmarks ??
    null;
  const formulaTrace =
    (nestedSnapshot?.formulaTrace as
      | ApiDealPricingFormulaTrace
      | null
      | undefined) ??
    quote.formulaTrace ??
    null;
  const profitability =
    (nestedSnapshot?.profitability as
      | ApiDealPricingProfitability
      | null
      | undefined) ??
    quote.profitability ??
    null;

  if (!benchmarks && !formulaTrace && !profitability) {
    return null;
  }

  return {
    benchmarks,
    formulaTrace,
    profitability,
  };
}

function PricingMetricTile({
  label,
  sublabel,
  testId,
  tone = "default",
  value,
}: {
  label: string;
  sublabel?: string;
  testId?: string;
  tone?: "default" | "positive" | "negative";
  value: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-xl border bg-background px-4 py-3",
        tone === "positive" ? "border-emerald-200 bg-emerald-50/80" : null,
        tone === "negative" ? "border-destructive/30 bg-destructive/10" : null,
      )}
    >
      <div
        className={cn(
          "text-xs uppercase tracking-wide text-muted-foreground",
          tone === "positive" ? "text-emerald-700/80" : null,
          tone === "negative" ? "text-destructive/80" : null,
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 whitespace-nowrap text-base font-semibold tabular-nums",
          tone === "positive" ? "text-emerald-900" : null,
          tone === "negative" ? "text-destructive" : null,
        )}
      >
        {value}
      </div>
      {sublabel ? (
        <div
          className={cn(
            "mt-1 text-[11px] text-muted-foreground",
            tone === "positive" ? "text-emerald-700/70" : null,
            tone === "negative" ? "text-destructive/70" : null,
          )}
        >
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

export function serializeFormulaTrace(
  trace: ApiDealPricingFormulaTrace | null | undefined,
): string {
  if (!trace?.sections?.length) {
    return "";
  }

  const blocks: string[] = [];
  for (const section of trace.sections) {
    const lines: string[] = [section.title];
    for (const line of section.lines) {
      if (line.kind === "equation") {
        lines.push(line.expression);
      } else {
        lines.push(
          line.label ? `${line.label}: ${line.expression}` : line.expression,
        );
      }
    }
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}

const EXPIRES_ABSOLUTE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZoneName: "short",
});

const DEADLINE_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
});

const DEADLINE_DATETIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

function formatAbsoluteExpiresAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return EXPIRES_ABSOLUTE_FORMATTER.format(date);
}

function formatExpiresCountdown(
  iso: string | null | undefined,
  nowMs: number,
): { label: string; isExpired: boolean } {
  if (!iso) return { label: "—", isExpired: false };
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return { label: "—", isExpired: false };

  const diffMs = target - nowMs;
  const totalMinutes = Math.abs(Math.floor(diffMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ч`);
  parts.push(`${minutes} мин`);
  const duration = parts.join(" ");

  if (diffMs <= 0) {
    return { isExpired: true, label: `истекла ${duration} назад` };
  }

  return { isExpired: false, label: `через ${duration}` };
}

function formatFundingDeadline(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const hours = date.getHours();
  const minutes = date.getMinutes();
  // Treat 00:00 / 23:59 as all-day deadlines → render "dd MMM EOD" without the time.
  if ((hours === 0 && minutes === 0) || (hours === 23 && minutes === 59)) {
    return `${DEADLINE_DATE_FORMATTER.format(date)} EOD`;
  }
  return DEADLINE_DATETIME_FORMATTER.format(date);
}

const REVOCATION_REASON_LABELS: Record<string, string> = {
  operator_commercial_amendment: "условия изменены казначейством",
  operator_route_swap: "маршрут изменён казначейством",
};

function formatRevocationReason(
  reason: string | null | undefined,
): string | null {
  if (!reason) return null;
  return REVOCATION_REASON_LABELS[reason] ?? reason;
}

function formatFeeBasis(fee: {
  kind: "fixed" | "fx_spread" | "gross_percent" | "net_percent";
  percentage?: string;
}): string {
  if (fee.kind === "fixed") {
    return "фикс";
  }

  const percent = fee.percentage ?? "0";

  if (fee.kind === "fx_spread") {
    return `${percent}% · спред`;
  }

  if (fee.kind === "net_percent") {
    return `${percent}% · нетто`;
  }

  return `${percent}%`;
}

function FeeBreakdownCard({
  currencyCodeById,
  preview,
}: {
  currencyCodeById: Map<string, string>;
  preview: ApiDealPricingPreview;
}) {
  const route = preview.routePreview;

  if (!route) {
    return null;
  }

  type BreakdownRow = {
    amount: string;
    basis: string;
    component: string;
    key: string;
    provider: string;
    tone: "default" | "muted";
  };

  const rows: BreakdownRow[] = [];

  route.executionCostLines.forEach((fee) => {
    const currency = currencyCodeById.get(fee.currencyId) ?? fee.currencyId;
    rows.push({
      amount: formatMinorAmount(fee.amountMinor, currency),
      basis: formatFeeBasis(fee),
      component: fee.label ?? "Расход исполнения",
      key: `${fee.location}-${fee.id}`,
      provider: fee.location === "leg" ? "Шаг маршрута" : "Отдельно",
      tone: "muted",
    });
  });

  const profitability = preview.profitability;
  const hasMarginRow =
    profitability !== null && BigInt(profitability.commercialRevenueMinor) > 0n;

  if (hasMarginRow) {
    rows.push({
      amount: formatMinorAmount(
        profitability.commercialRevenueMinor,
        profitability.currency,
      ),
      basis: "маржа",
      component: "Маржа",
      key: "margin",
      provider: "Bedrock",
      tone: "default",
    });
  }

  const totalFeeMinor = route.executionCostLines.reduce(
    (total, fee) => total + BigInt(fee.routeInputImpactMinor),
    0n,
  );
  const hasRows = rows.length > 0;
  const feeCurrency =
    currencyCodeById.get(route.currencyInId) ?? route.currencyInId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Разбивка комиссий</CardTitle>
      </CardHeader>
      <CardContent>
        {hasRows ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Компонент</TableHead>
                <TableHead>Провайдер</TableHead>
                <TableHead>База</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell
                    className={
                      row.tone === "muted" ? "text-muted-foreground" : undefined
                    }
                  >
                    {row.component}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.provider}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.basis}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.amount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  Итого
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMinorAmount(totalFeeMinor.toString(), feeCurrency)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <div className="text-sm text-muted-foreground">
            В маршруте нет комиссий и доплат.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DealPricingTab({
  acceptedQuote,
  amountCurrencyPrecision,
  currentCalculationId,
  dealId,
  fundingDeadline,
  initialRequestedAmount,
  onError,
  onReload,
  pricingContext,
  quoteAmountSide,
  quoteCreationDisabledReason,
  quotes,
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
  const [amountInput, setAmountInput] = useState(initialRequestedAmount);
  const [asOfInput, setAsOfInput] = useState(formatDateTimeInput(new Date()));
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [reLockDialogOpen, setReLockDialogOpen] = useState(false);
  const [acceptances, setAcceptances] = useState<
    ApiDealQuoteAcceptanceHistoryItem[]
  >([]);
  const [inventoryPositions, setInventoryPositions] = useState<
    ApiTreasuryInventoryPosition[]
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [downloadingHistoryCalculationId, setDownloadingHistoryCalculationId] =
    useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 60_000);
    return () => {
      clearInterval(interval);
    };
  }, []);

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
    fetchJson<ApiDealQuoteAcceptanceHistoryItem[]>(
      `${API_BASE_URL}/deals/${dealId}/pricing/acceptances`,
    )
      .then((rows) => {
        if (!cancelled) setAcceptances(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dealId, acceptedQuote?.quoteId]);

  const currencyCodeById = useMemo(
    () =>
      new Map(currencyOptions.map((currency) => [currency.id, currency.code])),
    [currencyOptions],
  );

  const amountInputPrecision =
    quoteAmountSide === "source"
      ? amountCurrencyPrecision
      : targetCurrencyPrecision;
  const requestedTargetMinor =
    quoteAmountSide === "target"
      ? decimalToMinorString(amountInput, targetCurrencyPrecision)
      : null;
  const targetCurrencyId =
    serverContext.routeAttachment?.snapshot.currencyOutId ?? null;
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

  useEffect(() => {
    if (!targetCurrencyId) {
      setInventoryPositions([]);
      return;
    }
    let cancelled = false;
    const query = new URLSearchParams({
      currencyId: targetCurrencyId,
      limit: "100",
      offset: "0",
      state: "open",
    });
    fetchJson<{
      data: ApiTreasuryInventoryPosition[];
    }>(`${API_BASE_URL}/treasury/orders/inventory/positions?${query.toString()}`)
      .then((payload) => {
        if (cancelled) return;
        const beneficiaryMinor =
          requestedTargetMinor && requestedTargetMinor !== "0"
            ? BigInt(requestedTargetMinor)
            : 0n;
        setInventoryPositions(
          payload.data.filter(
            (position) =>
              beneficiaryMinor === 0n ||
              BigInt(position.availableAmountMinor) >= beneficiaryMinor,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setInventoryPositions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [requestedTargetMinor, targetCurrencyId]);
  const acceptedDetailedQuote = acceptedQuote
    ? (quotes.find((quote) => quote.id === acceptedQuote.quoteId) ?? null)
    : null;
  const acceptedDetailedQuoteSnapshot = extractStoredPricingSnapshot(
    acceptedDetailedQuote,
  );
  const previewSnapshot = preview
    ? {
        benchmarks: preview.benchmarks,
        formulaTrace: preview.formulaTrace,
        profitability: preview.profitability,
      }
    : null;
  const previewOrAcceptedSnapshot =
    previewSnapshot ?? (lastSyncedAt ? null : acceptedDetailedQuoteSnapshot);

  const pricingState: "none" | "locked" | "drifted" | "expired" =
    useMemo(() => {
      if (!acceptedQuote) return "none";
      const expiresAt = acceptedQuote.expiresAt
        ? new Date(acceptedQuote.expiresAt).getTime()
        : null;
      if (expiresAt !== null && nowTick > expiresAt) return "expired";
      const acceptedFp = acceptedDetailedQuote?.pricingFingerprint ?? null;
      const previewFp = preview?.pricingFingerprint ?? null;
      if (acceptedFp === null || previewFp === null) return "locked";
      if (acceptedFp === previewFp) return "locked";
      return "drifted";
    }, [
      acceptedQuote,
      acceptedDetailedQuote?.pricingFingerprint,
      preview?.pricingFingerprint,
      nowTick,
    ]);

  const handleCommit = async () => {
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
          "Не удалось зафиксировать котировку",
          autoSyncError ?? "Не удалось подготовить расчет для котировки.",
        );
        return;
      }

      await fetchJson<ApiDealPricingQuoteResult & { calculationId: string }>(
        `${API_BASE_URL}/deals/${dealId}/pricing/commit`,
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
      setReLockDialogOpen(false);
      await onReload();
    } catch (error) {
      if (error instanceof ApiError && error.code === "rate_already_locked") {
        toast.info(
          "Котировка уже зафиксирована на тех же условиях и ещё действительна",
        );
        setReLockDialogOpen(false);
        await onReload();
        return;
      }
      onError(
        "Не удалось зафиксировать котировку",
        error instanceof Error
          ? error.message
          : "Не удалось зафиксировать котировку.",
      );
    } finally {
      setIsCreatingQuote(false);
    }
  };

  const formulaTrace = previewOrAcceptedSnapshot?.formulaTrace ?? null;
  const canCopyCalculation = Boolean(formulaTrace?.sections?.length);
  const canDownloadPdf = Boolean(acceptedQuote && currentCalculationId);
  const clientPricingDraft =
    commercialDraft.clientPricing ?? defaultClientPricing();

  const handleCopyCalculation = useCallback(() => {
    const text = serializeFormulaTrace(formulaTrace);
    if (!text) {
      toast.error("Нет расчёта для копирования");
      return;
    }
    if (
      typeof navigator === "undefined" ||
      typeof navigator.clipboard?.writeText !== "function"
    ) {
      toast.error("Копирование недоступно в этом браузере");
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast.success("Расчёт скопирован в буфер обмена"),
      () => toast.error("Не удалось скопировать"),
    );
  }, [formulaTrace]);

  const downloadPricingPdf = useCallback(async (calculationId: string) => {
    await downloadPrintForm({
      client: { baseUrl: API_BASE_URL, credentials: "include" },
      fallbackFileName: `calculation-${calculationId}.pdf`,
      form: {
        id: "calculation.calculation-ru",
        title: "Расчет",
      },
      format: "pdf",
      owner: {
        type: "calculation",
        calculationId,
      },
    });
  }, []);

  const handleDownloadHistoryPdf = useCallback(
    async (calculationId: string) => {
      setDownloadingHistoryCalculationId(calculationId);
      try {
        await downloadPricingPdf(calculationId);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось скачать PDF",
        );
      } finally {
        setDownloadingHistoryCalculationId(null);
      }
    },
    [downloadPricingPdf],
  );

  const handleCopyHistoryRow = useCallback(
    (quoteId: string) => {
      const quote = quotes.find((q) => q.id === quoteId);
      const trace =
        extractStoredPricingSnapshot(quote ?? null)?.formulaTrace ??
        quote?.formulaTrace ??
        null;
      const text = serializeFormulaTrace(trace);
      if (!text) {
        toast.error("Формула расчёта недоступна для этой котировки");
        return;
      }
      if (
        typeof navigator === "undefined" ||
        typeof navigator.clipboard?.writeText !== "function"
      ) {
        toast.error("Копирование недоступно в этом браузере");
        return;
      }
      navigator.clipboard.writeText(text).then(
        () => toast.success("Расчёт скопирован в буфер обмена"),
        () => toast.error("Не удалось скопировать"),
      );
    },
    [quotes],
  );

  const handleDownloadPdf = useCallback(async () => {
    if (!currentCalculationId) {
      toast.error("Расчет недоступен для выгрузки");
      return;
    }

    setIsDownloadingPdf(true);
    try {
      await downloadPricingPdf(currentCalculationId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось скачать PDF",
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [currentCalculationId, downloadPricingPdf]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Котировка</CardTitle>
              <CardDescription>
                {quoteAmountSide === "target"
                  ? "Фиксируется сумма выплаты бенефициару"
                  : "Фиксируется исходная сумма списания"}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  disabled={!canCopyCalculation}
                  onClick={handleCopyCalculation}
                  size="sm"
                  variant="outline"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Копировать расчёт
                </Button>
                <Button
                  disabled={!canDownloadPdf || isDownloadingPdf}
                  onClick={() => void handleDownloadPdf()}
                  size="sm"
                  variant="outline"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Скачать PDF
                </Button>
                <Button
                  data-testid="deal-commit-pricing-button-top"
                  disabled={
                    pricingState === "locked" ||
                    Boolean(quoteCreationDisabledReason) ||
                    isCreatingQuote
                  }
                  onClick={() => {
                    if (pricingState === "drifted") {
                      setReLockDialogOpen(true);
                      return;
                    }
                    void handleCommit();
                  }}
                  size="sm"
                  variant={pricingState === "locked" ? "outline" : "default"}
                >
                  {isCreatingQuote
                    ? "Фиксируем..."
                    : pricingState === "locked"
                      ? "Зафиксировано"
                      : pricingState === "drifted"
                        ? "Обновить курс"
                        : pricingState === "expired"
                          ? "Зафиксировать новый курс"
                          : "Принять и зафиксировать"}
                </Button>
              </div>
              {isAutoSyncing ? (
                <div className="text-xs text-muted-foreground">Пересчёт…</div>
              ) : lastSyncedAt ? (
                <div className="text-xs text-muted-foreground">
                  Обновлено {formatDate(lastSyncedAt)}
                </div>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {previewOrAcceptedSnapshot?.profitability ? (
            (() => {
              const beneficiaryQuote =
                preview?.quotePreview ?? acceptedDetailedQuote;
              const profit = previewOrAcceptedSnapshot.profitability;
              const profitValue = BigInt(profit.profitMinor);
              const isProfitNegative = profitValue < 0n;
              const routeBench =
                previewOrAcceptedSnapshot.benchmarks?.routeBase ?? null;
              const marketBench =
                previewOrAcceptedSnapshot.benchmarks?.market ?? null;
              const clientBench =
                previewOrAcceptedSnapshot.benchmarks?.client ?? null;
              const referenceBench = routeBench ?? marketBench;
              const selectedInventoryId =
                commercialDraft.executionSource.type === "treasury_inventory"
                  ? commercialDraft.executionSource.inventoryPositionId
                  : null;
              const selectedInventory =
                selectedInventoryId === null
                  ? null
                  : inventoryPositions.find(
                      (position) => position.id === selectedInventoryId,
                    );

              return (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <PricingMetricTile
                    label={
                      quoteAmountSide === "target"
                        ? "Cписание c клиента"
                        : "Сумма сделки"
                    }
                    sublabel={
                      quoteAmountSide === "target"
                        ? "расчётная сумма"
                        : "клиент платит"
                    }
                    testId="quote-summary-metric"
                    value={formatMinorAmount(
                      profit.customerTotalMinor,
                      profit.currency,
                    )}
                  />
                  <PricingMetricTile
                    label={
                      quoteAmountSide === "target"
                        ? "Бенефициар получит"
                        : "Сумма получения"
                    }
                    testId="quote-summary-metric"
                    value={
                      beneficiaryQuote
                        ? formatMinorAmount(
                            beneficiaryQuote.toAmountMinor,
                            beneficiaryQuote.toCurrency,
                          )
                        : "—"
                    }
                  />
                  <PricingMetricTile
                    label="Себестоимость маршрута"
                    testId="quote-summary-metric"
                    value={formatMinorAmount(
                      profit.costPriceMinor,
                      profit.currency,
                    )}
                  />
                  <PricingMetricTile
                    label="Источник исполнения"
                    sublabel={
                      selectedInventory
                        ? `Позиция #${selectedInventory.id.slice(0, 8)}`
                        : undefined
                    }
                    testId="quote-summary-metric"
                    value={
                      commercialDraft.executionSource.type ===
                      "treasury_inventory"
                        ? "Инвентарь"
                        : "Маршрут"
                    }
                  />
                  <PricingMetricTile
                    label={
                      marketBench
                        ? `Рыночный курс (${marketBench.baseCurrency}/${marketBench.quoteCurrency})`
                        : "Рыночный курс"
                    }
                    sublabel={marketBench?.sourceLabel ?? "рыночный benchmark"}
                    testId="quote-summary-metric"
                    value={
                      marketBench
                        ? rationalToDecimalString(
                            marketBench.rateDen,
                            marketBench.rateNum,
                            4,
                          )
                        : "—"
                    }
                  />
                  <PricingMetricTile
                    label={
                      routeBench
                        ? `Курс маршрута (${routeBench.baseCurrency}/${routeBench.quoteCurrency})`
                        : "Курс маршрута"
                    }
                    sublabel={
                      routeBench
                        ? (routeBench.sourceLabel ?? "база по шагам маршрута")
                        : "маршрут не выбран"
                    }
                    testId="quote-summary-metric"
                    value={
                      routeBench
                        ? rationalToDecimalString(
                            routeBench.rateDen,
                            routeBench.rateNum,
                            4,
                          )
                        : "—"
                    }
                  />
                  {(() => {
                    const markupVsMarket =
                      clientBench && marketBench
                        ? formatSignedPercentVsRate(
                            clientBench.rateNum,
                            clientBench.rateDen,
                            marketBench.rateNum,
                            marketBench.rateDen,
                          )
                        : null;
                    const baseLabel = referenceBench
                      ? `База ${rationalToDecimalString(referenceBench.rateDen, referenceBench.rateNum, 4)}`
                      : null;
                    const markupLabel = markupVsMarket
                      ? `${markupVsMarket} к рынку`
                      : null;
                    const sublabel =
                      baseLabel && markupLabel
                        ? `${baseLabel} · ${markupLabel}`
                        : (baseLabel ?? markupLabel ?? undefined);
                    return (
                      <PricingMetricTile
                        label="Курс клиенту"
                        sublabel={sublabel}
                        testId="quote-summary-metric"
                        value={
                          clientBench
                            ? rationalToDecimalString(
                                clientBench.rateDen,
                                clientBench.rateNum,
                                4,
                              )
                            : "—"
                        }
                      />
                    );
                  })()}
                  <PricingMetricTile
                    label="Чистая прибыль"
                    sublabel="после операционных издержек"
                    testId="quote-summary-metric"
                    tone={
                      profitValue === 0n
                        ? "default"
                        : isProfitNegative
                          ? "negative"
                          : "positive"
                    }
                    value={`${profitValue === 0n ? "" : isProfitNegative ? "−\u00A0" : "+\u00A0"}${formatMinorAmount(
                      (isProfitNegative
                        ? -profitValue
                        : profitValue
                      ).toString(),
                      profit.currency,
                    )}`}
                  />
                </div>
              );
            })()
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Укажите сумму, курс и маршрут — котировка появится автоматически.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Входные данные
          </CardTitle>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Маршрут</Label>
              <RoutePreview
                currencyCodeById={currencyCodeById}
                routeAttachment={serverContext.routeAttachment}
              />
            </div>
            <div className="space-y-2">
              <Label>Источник исполнения</Label>
              <Select
                value={
                  commercialDraft.executionSource.type === "treasury_inventory"
                    ? `inventory:${commercialDraft.executionSource.inventoryPositionId}`
                    : "route_execution"
                }
                onValueChange={(value) => {
                  if (!value) return;
                  setCommercialDraft((current) => ({
                    ...current,
                    executionSource: value.startsWith("inventory:")
                      ? {
                          inventoryPositionId: value.slice("inventory:".length),
                          type: "treasury_inventory",
                        }
                      : { type: "route_execution" },
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="route_execution">
                    Маршрут исполнения
                  </SelectItem>
                  {inventoryPositions.map((position) => (
                    <SelectItem
                      key={position.id}
                      value={`inventory:${position.id}`}
                    >
                      {formatInventoryPositionLabel(position, currencyCodeById)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Инвентарь показывается только по валюте выплаты и доступному
                остатку.
              </p>
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
              <Label>Цена клиенту</Label>
              <Select
                onValueChange={(value) =>
                  setCommercialDraft((current) => ({
                    ...current,
                    clientPricing: {
                      ...(current.clientPricing ?? defaultClientPricing()),
                      mode:
                        value === "client_total"
                          ? "client_total"
                          : "client_rate",
                    },
                    quoteMarkupBps: null,
                  }))
                }
                value={clientPricingDraft.mode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_rate">Курс</SelectItem>
                  <SelectItem value="client_total">Сумма</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {clientPricingDraft.mode === "client_rate" ? (
              <div className="space-y-2">
                <Label>Курс клиенту</Label>
                <Input
                  inputMode="decimal"
                  onChange={(event) => {
                    const clientRate = decimalRateToFraction(event.target.value);
                    setCommercialDraft((current) => ({
                      ...current,
                      clientPricing: {
                        ...(current.clientPricing ?? defaultClientPricing()),
                        clientRate,
                        mode: "client_rate",
                      },
                      quoteMarkupBps: null,
                    }));
                  }}
                  placeholder="0.000000"
                  value={fractionRateToDecimal(clientPricingDraft.clientRate)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Сумма списания клиента</Label>
                <Input
                  inputMode="decimal"
                  onChange={(event) => {
                    const minor = decimalToMinorString(
                      event.target.value,
                      amountCurrencyPrecision,
                    );
                    setCommercialDraft((current) => ({
                      ...current,
                      clientPricing: {
                        ...(current.clientPricing ?? defaultClientPricing()),
                        clientTotalMinor: minor,
                        mode: "client_total",
                      },
                      quoteMarkupBps: null,
                    }));
                  }}
                  placeholder="0.00"
                  value={
                    clientPricingDraft.clientTotalMinor
                      ? minorToDecimalString(
                          clientPricingDraft.clientTotalMinor,
                          amountCurrencyPrecision,
                        )
                      : ""
                  }
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Коммерческая комиссия</Label>
              <InputGroup>
                <Input
                  data-slot="input-group-control"
                  inputMode="decimal"
                  className="flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent"
                  onChange={(event) =>
                    setCommercialDraft((current) => ({
                      ...current,
                      fixedFeeAmount: event.target.value || null,
                    }))
                  }
                  placeholder="0.00"
                  value={commercialDraft.fixedFeeAmount ?? ""}
                />
                <InputGroupAddon align="inline-end" className="p-0">
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
                    <SelectTrigger
                      aria-label="Валюта фиксированной комиссии"
                      className="h-full border-0 bg-transparent px-2 font-medium shadow-none focus-visible:ring-0"
                    >
                      <SelectValue>
                        {commercialDraft.fixedFeeCurrency ?? "—"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="__none__">Нет</SelectItem>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      {preview?.routePreview ? (
        <FeeBreakdownCard
          currencyCodeById={currencyCodeById}
          preview={preview}
        />
      ) : null}

      {(() => {
        const expiresIso =
          acceptedQuote?.expiresAt ?? preview?.quotePreview?.expiresAt ?? null;
        const countdown = formatExpiresCountdown(expiresIso, nowTick);
        const revocationLabel = acceptedQuote?.revokedAt
          ? formatRevocationReason(acceptedQuote.revocationReason)
          : null;
        const countdownSublabel =
          pricingState === "drifted"
            ? "лок действителен, но пришли новые условия"
            : pricingState === "expired"
              ? (revocationLabel ?? "требуется новый лок")
              : "по умолчанию — 1 день";
        return (
          <Card>
            <CardHeader>
              <CardTitle>Срок действия котировки</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <PricingMetricTile
                  label="Курс зафиксирован до"
                  sublabel="действие котировки"
                  value={formatAbsoluteExpiresAt(expiresIso)}
                />
                <PricingMetricTile
                  label="Котировка истекает"
                  sublabel={countdownSublabel}
                  tone={
                    pricingState === "expired" || countdown.isExpired
                      ? "negative"
                      : "default"
                  }
                  value={countdown.label}
                />
                <PricingMetricTile
                  label="Срок фондирования"
                  sublabel="из параметров сделки"
                  value={formatFundingDeadline(fundingDeadline)}
                />
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setHistoryOpen((current) => !current)}
        >
          <div className="flex items-center justify-between gap-3">
            <CardTitle>История котировок ({acceptances.length})</CardTitle>
            {historyOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {historyOpen ? (
          <CardContent>
            {acceptances.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                Пока нет зафиксированных котировок.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Курс</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acceptances.map((row) => {
                    const expiresMs = row.expiresAt
                      ? new Date(row.expiresAt).getTime()
                      : null;
                    const status: "current" | "superseded" | "expired" =
                      row.revokedAt !== null
                        ? "superseded"
                        : expiresMs !== null && nowTick > expiresMs
                          ? "expired"
                          : "current";
                    const statusLabel =
                      status === "current"
                        ? "Активна"
                        : status === "superseded"
                          ? "Заменена"
                          : "Истекла";
                    const statusClasses =
                      status === "current"
                        ? "inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        : status === "expired"
                          ? "inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                          : "inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground";
                    const rate = rationalToDecimalString(
                      row.rateDen,
                      row.rateNum,
                      4,
                    );
                    const customerTotal = row.customerTotalMinor
                      ? formatMinorAmount(
                          row.customerTotalMinor,
                          row.fromCurrency,
                        )
                      : formatMinorAmount(
                          row.fromAmountMinor,
                          row.fromCurrency,
                        );
                    return (
                      <TableRow key={row.acceptanceId}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(row.acceptedAt)}
                        </TableCell>
                        <TableCell className="tabular-nums">{rate}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {customerTotal}
                        </TableCell>
                        <TableCell>
                          <span className={statusClasses}>{statusLabel}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              onClick={() => handleCopyHistoryRow(row.quoteId)}
                              size="sm"
                              variant="ghost"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="sr-only">Копировать</span>
                            </Button>
                            <Button
                              disabled={
                                !row.calculationId ||
                                downloadingHistoryCalculationId ===
                                  row.calculationId
                              }
                              onClick={() =>
                                row.calculationId
                                  ? void handleDownloadHistoryPdf(
                                      row.calculationId,
                                    )
                                  : undefined
                              }
                              size="sm"
                              variant="ghost"
                            >
                              {downloadingHistoryCalculationId ===
                              row.calculationId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              <span className="sr-only">PDF</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        ) : null}
      </Card>

      {(() => {
        if (!acceptedDetailedQuote || !preview?.quotePreview) {
          return null;
        }
        const oldQuote = acceptedDetailedQuote;
        const oldProfit = acceptedDetailedQuoteSnapshot?.profitability ?? null;
        const oldRate = rationalToDecimalString(
          oldQuote.rateDen,
          oldQuote.rateNum,
          4,
        );
        const oldTotal = oldProfit
          ? formatMinorAmount(oldProfit.customerTotalMinor, oldProfit.currency)
          : "—";
        const oldFee = oldProfit
          ? formatMinorAmount(
              (
                BigInt(oldProfit.customerTotalMinor) -
                BigInt(oldProfit.customerPrincipalMinor)
              ).toString(),
              oldProfit.currency,
            )
          : "—";

        const newQuote = preview.quotePreview;
        const newProfit = preview.profitability;
        const newRate = rationalToDecimalString(
          newQuote.rateDen,
          newQuote.rateNum,
          4,
        );
        const newTotal = newProfit
          ? formatMinorAmount(newProfit.customerTotalMinor, newProfit.currency)
          : "—";
        const newFee = newProfit
          ? formatMinorAmount(
              (
                BigInt(newProfit.customerTotalMinor) -
                BigInt(newProfit.customerPrincipalMinor)
              ).toString(),
              newProfit.currency,
            )
          : "—";

        return (
          <AlertDialog
            open={reLockDialogOpen}
            onOpenChange={setReLockDialogOpen}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Обновить зафиксированный курс?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Текущая зафиксированная котировка будет заменена новой. Клиент
                  получит новые условия.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid grid-cols-2 gap-4 py-2 text-sm">
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">Было</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {oldRate}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {oldTotal} • комиссия {oldFee}
                  </div>
                </div>
                <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Станет</div>
                  <div className="mt-1 text-base font-semibold tabular-nums">
                    {newRate}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {newTotal} • комиссия {newFee}
                  </div>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isCreatingQuote}>
                  Отмена
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isCreatingQuote}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleCommit();
                  }}
                >
                  {isCreatingQuote ? "Обновляем..." : "Подтвердить обновление"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </div>
  );
}
