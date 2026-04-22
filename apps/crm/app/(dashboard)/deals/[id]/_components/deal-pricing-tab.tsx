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
import type {
  ApiDealAcceptedQuote,
  ApiDealPricingBenchmarks,
  ApiDealPricingContext,
  ApiDealPricingFormulaTrace,
  ApiDealPricingPreview,
  ApiDealPricingProfitability,
  ApiDealPricingQuote,
  ApiDealPricingQuoteResult,
  ApiDealPricingRouteCandidate,
  ApiDealQuoteAcceptanceHistoryItem,
  ApiCurrencyOption,
} from "./types";
import { useDealPricingAutoSync } from "./use-deal-pricing-auto-sync";

type DealPricingTabProps = {
  acceptedQuote: ApiDealAcceptedQuote;
  amountCurrencyPrecision: number;
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

function formatMinorAmount(amountMinor: string, currency: string) {
  return formatCurrency(
    minorToDecimalString(amountMinor, getCurrencyPrecision(currency)),
    currency,
  );
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

  // Prefer the metadata-nested snapshot (older quote shape) but fall back to
  // the top-level quote fields when present — the workflow exposes benchmarks /
  // formulaTrace / profitability directly on the quote too, and the metadata
  // copy can be absent on historical rows.
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

function bpsToPercentString(bps: number | null): string {
  if (bps === null) {
    return "";
  }
  const whole = Math.trunc(bps / 100);
  const fraction = Math.abs(bps % 100);
  if (fraction === 0) {
    return whole.toString();
  }
  return `${whole},${fraction.toString().padStart(2, "0")}`.replace(
    /,?0+$/,
    "",
  );
}

function MarkupPercentInput({
  bps,
  onCommit,
}: {
  bps: number | null;
  onCommit: (nextBps: number | null) => void;
}) {
  const [draft, setDraft] = useState(bpsToPercentString(bps));

  useEffect(() => {
    setDraft(bpsToPercentString(bps));
  }, [bps]);

  function commit(raw: string) {
    const normalized = raw.trim().replace(",", ".");
    if (normalized === "") {
      onCommit(null);
      setDraft("");
      return;
    }
    if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
      setDraft(bpsToPercentString(bps));
      return;
    }
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(bpsToPercentString(bps));
      return;
    }
    const nextBps = Math.round(parsed * 100);
    onCommit(nextBps);
  }

  return (
    <Input
      inputMode="decimal"
      placeholder="0.25"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit(event.currentTarget.value);
        }
      }}
    />
  );
}

function PricingMetricTile({
  label,
  sublabel,
  tone = "default",
  value,
}: {
  label: string;
  sublabel?: string;
  tone?: "default" | "positive" | "negative";
  value: string;
}) {
  return (
    <div
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

  route.legs.forEach((leg, legIndex) => {
    leg.fees.forEach((fee) => {
      const currency = currencyCodeById.get(fee.currencyId) ?? fee.currencyId;
      rows.push({
        amount: formatMinorAmount(fee.amountMinor, currency),
        basis: formatFeeBasis(fee),
        component: fee.label ?? "Комиссия",
        key: `leg-${leg.id}-${fee.id}`,
        provider: `Шаг ${legIndex + 1}`,
        tone: fee.chargeToCustomer ? "default" : "muted",
      });
    });
  });

  route.additionalFees.forEach((fee) => {
    const currency = currencyCodeById.get(fee.currencyId) ?? fee.currencyId;
    rows.push({
      amount: formatMinorAmount(fee.amountMinor, currency),
      basis: formatFeeBasis(fee),
      component: fee.label ?? "Доплата",
      key: `additional-${fee.id}`,
      provider: "Bedrock",
      tone: fee.chargeToCustomer ? "default" : "muted",
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

  const totalFeeMinor =
    BigInt(route.costPriceInMinor) - BigInt(route.amountInMinor);
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
  const [routeCandidates, setRouteCandidates] = useState<
    ApiDealPricingRouteCandidate[]
  >([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [amountInput, setAmountInput] = useState(initialRequestedAmount);
  const [asOfInput, setAsOfInput] = useState(formatDateTimeInput(new Date()));
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [routeSyncNonce, setRouteSyncNonce] = useState(0);
  const [reLockDialogOpen, setReLockDialogOpen] = useState(false);
  const [acceptances, setAcceptances] = useState<
    ApiDealQuoteAcceptanceHistoryItem[]
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [downloadingHistoryQuoteId, setDownloadingHistoryQuoteId] = useState<
    string | null
  >(null);

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
    () =>
      new Map(currencyOptions.map((currency) => [currency.id, currency.code])),
    [currencyOptions],
  );

  const amountInputPrecision =
    quoteAmountSide === "source"
      ? amountCurrencyPrecision
      : targetCurrencyPrecision;
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

  function applyServerContext(nextContext: ApiDealPricingContext) {
    setServerContext(nextContext);
    setCommercialDraft(cloneCommercialDraft(nextContext));
    setFundingAdjustments(cloneFundingAdjustments(nextContext));
  }

  const handleRouteChange = async (nextRouteId: string) => {
    const currentRouteId = serverContext.routeAttachment?.templateId ?? "";

    if (nextRouteId === currentRouteId) {
      setSelectedRouteId(nextRouteId);
      return;
    }

    const previousSelectedRouteId = selectedRouteId;
    setSelectedRouteId(nextRouteId);

    try {
      await flushSync().catch(() => null);
      const nextContext = nextRouteId
        ? await fetchJson<ApiDealPricingContext>(
            `${API_BASE_URL}/deals/${dealId}/pricing/route/attach`,
            {
              body: JSON.stringify({ routeTemplateId: nextRouteId }),
              headers: {
                "Content-Type": "application/json",
              },
              method: "POST",
            },
          )
        : await fetchJson<ApiDealPricingContext>(
            `${API_BASE_URL}/deals/${dealId}/pricing/route`,
            {
              method: "DELETE",
            },
          );

      applyServerContext(nextContext);
      setRouteSyncNonce((current) => current + 1);
    } catch (error) {
      setSelectedRouteId(previousSelectedRouteId);
      onError(
        nextRouteId ? "Ошибка выбора маршрута" : "Ошибка удаления маршрута",
        error instanceof Error
          ? error.message
          : nextRouteId
            ? "Не удалось выбрать маршрут."
            : "Не удалось убрать маршрут.",
      );
    }
  };

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
  const canDownloadPdf = Boolean(acceptedQuote);

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

  const downloadPricingPdf = useCallback(
    async (quoteId: string | null) => {
      const qs = quoteId
        ? `format=pdf&quoteId=${encodeURIComponent(quoteId)}`
        : "format=pdf";
      const response = await fetch(
        `${API_BASE_URL}/deals/${dealId}/pricing/export?${qs}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );
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
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      let filename = "calculation.pdf";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/u);
        if (match?.[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    [dealId],
  );

  const handleDownloadHistoryPdf = useCallback(
    async (quoteId: string) => {
      setDownloadingHistoryQuoteId(quoteId);
      try {
        await downloadPricingPdf(quoteId);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось скачать PDF",
        );
      } finally {
        setDownloadingHistoryQuoteId(null);
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
    setIsDownloadingPdf(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/deals/${dealId}/pricing/export?format=pdf`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );

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

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      let filename = "calculation.pdf";
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/u);
        if (match?.[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось скачать PDF",
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (routeSyncNonce > 0) {
      requestImmediateSync();
    }
  }, [requestImmediateSync, routeSyncNonce]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Котировка</CardTitle>
              <CardDescription>
                Пересчитывается при каждом изменении
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
          {preview && previewOrAcceptedSnapshot?.profitability ? (
            (() => {
              const profit = previewOrAcceptedSnapshot.profitability;
              const profitValue = BigInt(profit.profitMinor);
              const isProfitNegative = profitValue < 0n;
              const totalFeeMinor =
                BigInt(profit.customerTotalMinor) -
                BigInt(profit.customerPrincipalMinor);
              const totalFeeValue = totalFeeMinor;
              const isFeeNegative = totalFeeValue < 0n;
              const routeBench =
                previewOrAcceptedSnapshot.benchmarks?.routeBase ?? null;
              const marketBench =
                previewOrAcceptedSnapshot.benchmarks?.market ?? null;
              const clientBench =
                previewOrAcceptedSnapshot.benchmarks?.client ?? null;
              const referenceBench = routeBench ?? marketBench;

              return (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <PricingMetricTile
                    label="Сумма сделки"
                    sublabel="клиент платит"
                    value={formatMinorAmount(
                      profit.customerTotalMinor,
                      profit.currency,
                    )}
                  />
                  <PricingMetricTile
                    label="Сумма получения"
                    sublabel="бенефициар получит"
                    value={
                      preview?.quotePreview
                        ? formatMinorAmount(
                            preview.quotePreview.toAmountMinor,
                            preview.quotePreview.toCurrency,
                          )
                        : "—"
                    }
                  />
                  <PricingMetricTile
                    label={
                      marketBench
                        ? `Рыночный курс (${marketBench.baseCurrency}/${marketBench.quoteCurrency})`
                        : "Рыночный курс"
                    }
                    sublabel={marketBench?.sourceLabel ?? "рыночный benchmark"}
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
                        ? (routeBench.sourceLabel ?? "composed base по легам")
                        : "маршрут не выбран"
                    }
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
                    label="Итого комиссия"
                    tone={isFeeNegative ? "negative" : "default"}
                    value={`${isFeeNegative ? "−\u00A0" : ""}${formatMinorAmount(
                      (isFeeNegative
                        ? -totalFeeValue
                        : totalFeeValue
                      ).toString(),
                      profit.currency,
                    )}`}
                  />
                  <PricingMetricTile
                    label="Чистая прибыль"
                    sublabel="после операционных издержек"
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
                  <PricingMetricTile
                    label="Маржа"
                    sublabel="на себестоимость"
                    tone={
                      Number(profit.profitPercentOnCost) === 0
                        ? "default"
                        : Number(profit.profitPercentOnCost) < 0
                          ? "negative"
                          : "positive"
                    }
                    value={`${profit.profitPercentOnCost}%`}
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
              <Select
                onValueChange={(value) => void handleRouteChange(value ?? "")}
                value={selectedRouteId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingRoutes
                        ? "Загрузка..."
                        : routeCandidates.length === 0
                          ? "Нет доступных шаблонов"
                          : "Без маршрута (auto-cross)"
                    }
                  >
                    {selectedRouteId === ""
                      ? "Без маршрута (auto-cross)"
                      : (routeCandidates.find(
                          (route) => route.id === selectedRouteId,
                        )?.name ?? "Маршрут не найден")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Без маршрута (auto-cross)</SelectItem>
                  {routeCandidates.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <MarkupPercentInput
                bps={commercialDraft.quoteMarkupBps}
                onCommit={(nextBps) =>
                  setCommercialDraft((current) => ({
                    ...current,
                    quoteMarkupBps: nextBps,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Фиксированная комиссия</Label>
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
        const countdownSublabel =
          pricingState === "drifted"
            ? "лок действителен, но пришли новые условия"
            : pricingState === "expired"
              ? "требуется новый лок"
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
                                downloadingHistoryQuoteId === row.quoteId
                              }
                              onClick={() =>
                                void handleDownloadHistoryPdf(row.quoteId)
                              }
                              size="sm"
                              variant="ghost"
                            >
                              {downloadingHistoryQuoteId === row.quoteId ? (
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
