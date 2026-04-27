import { z } from "zod";

import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";

const FINANCIAL_LINE_BUCKET_OPTIONS = [
  { value: "fee_revenue", label: "Комиссионный доход" },
  { value: "spread_revenue", label: "Спред" },
  { value: "provider_fee_expense", label: "Расход провайдера" },
  { value: "pass_through", label: "Транзитная комиссия" },
  { value: "adjustment", label: "Корректировка" },
] as const;

const QuotePreviewLegSchema = z.object({
  idx: z.number().int(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountMinor: z.string(),
  toAmountMinor: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
});

const QuoteFeeComponentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  currency: z.string(),
  amountMinor: z.string(),
  source: z.string(),
  accountingTreatment: z.string().optional(),
  memo: z.string().optional(),
});

const QuoteFinancialLineSchema = z.object({
  id: z.string(),
  bucket: z.string(),
  currency: z.string(),
  amountMinor: z.string(),
  source: z.enum(["rule", "manual"]),
  settlementMode: z.string().optional(),
  accountingTreatment: z.string().optional(),
  memo: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

const QuotePreviewResponseSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountMinor: z.string(),
  toAmountMinor: z.string(),
  fromAmount: z.string(),
  toAmount: z.string(),
  pricingMode: z.string(),
  pricingTrace: z.record(z.string(), z.unknown()),
  commercialTerms: z.unknown().nullable(),
  dealDirection: z.string().nullable(),
  dealForm: z.string().nullable(),
  rateNum: z.string(),
  rateDen: z.string(),
  expiresAt: z.iso.datetime(),
  legs: z.array(QuotePreviewLegSchema),
  feeComponents: z.array(QuoteFeeComponentSchema),
  financialLines: z.array(QuoteFinancialLineSchema),
});

export type QuotePreviewResponse = z.infer<typeof QuotePreviewResponseSchema>;

const financialLineBucketLabelByValue = new Map<string, string>(
  FINANCIAL_LINE_BUCKET_OPTIONS.map((option) => [option.value, option.label] as const),
);

export interface FxQuotePreviewRequest {
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: string;
}

export function buildFxQuotePreviewRequest(input: {
  amount: unknown;
  fromCurrency: unknown;
  toCurrency: unknown;
}): FxQuotePreviewRequest | null {
  const amount = typeof input.amount === "string" ? input.amount.trim() : "";
  const fromCurrency =
    typeof input.fromCurrency === "string"
      ? input.fromCurrency.trim().toUpperCase()
      : "";
  const toCurrency =
    typeof input.toCurrency === "string"
      ? input.toCurrency.trim().toUpperCase()
      : "";

  if (
    amount.length === 0 ||
    fromCurrency.length === 0 ||
    toCurrency.length === 0 ||
    fromCurrency === toCurrency
  ) {
    return null;
  }

  try {
    return {
      fromCurrency,
      toCurrency,
      fromAmountMinor: toMinorAmountString(amount, fromCurrency, {
        requirePositive: true,
      }),
    };
  } catch {
    return null;
  }
}

export async function fetchFxQuotePreview(input: {
  request: FxQuotePreviewRequest;
  signal?: AbortSignal;
}): Promise<QuotePreviewResponse> {
  const request = {
    mode: "auto_cross",
    fromCurrency: input.request.fromCurrency,
    toCurrency: input.request.toCurrency,
    fromAmountMinor: input.request.fromAmountMinor,
    asOf: new Date(),
  };
  const fromAmountMinor = request.fromAmountMinor;

  if (!fromAmountMinor) {
    throw new Error("Не удалось подготовить сумму для preview-котировки");
  }

  const response = await fetch(`/v1/treasury/quotes/preview`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    signal: input.signal,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...request,
      fromAmountMinor: fromAmountMinor.toString(),
    }),
  });

  if (!response.ok) {
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string" && payload.error.length > 0) {
        throw new Error(payload.error);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }

    throw new Error("Не удалось загрузить текущую котировку");
  }

  return QuotePreviewResponseSchema.parse(await response.json());
}

export function formatFxQuotePreviewMinorAmount(input: {
  amountMinor: string;
  currency: string;
}): string {
  return `${minorToAmountString(input.amountMinor, {
    currency: input.currency,
  })} ${input.currency}`;
}

export function formatFxQuotePreviewTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function getFinancialLineBucketLabel(bucket: string): string {
  return financialLineBucketLabelByValue.get(bucket) ?? bucket;
}
