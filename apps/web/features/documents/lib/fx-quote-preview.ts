import {
  FINANCIAL_LINE_BUCKET_OPTIONS,
} from "@bedrock/documents/contracts";
import {
  QuotePreviewResponseSchema,
  PreviewQuoteInputSchema,
  type QuotePreviewResponse,
} from "@bedrock/treasury/contracts";
import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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
  const request = PreviewQuoteInputSchema.parse({
    mode: "auto_cross",
    fromCurrency: input.request.fromCurrency,
    toCurrency: input.request.toCurrency,
    fromAmountMinor: input.request.fromAmountMinor,
    asOf: new Date(),
  });

  const response = await fetch(`${API_URL}/v1/treasury/quotes/preview`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    signal: input.signal,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...request,
      fromAmountMinor: request.fromAmountMinor.toString(),
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
