import { z } from "zod";

import {
  isValidCurrency,
  normalizeCurrency,
} from "@bedrock/currencies/catalog";
import { signedMinorAmountSchema } from "@bedrock/shared/money";

export const FINANCIAL_LINE_BUCKETS = [
  "fee_revenue",
  "spread_revenue",
  "provider_fee_expense",
  "pass_through",
  "adjustment",
] as const;

export const FINANCIAL_LINE_BUCKET_OPTIONS = [
  { value: "fee_revenue", label: "Комиссионный доход" },
  { value: "spread_revenue", label: "Спред" },
  { value: "provider_fee_expense", label: "Расход провайдера" },
  { value: "pass_through", label: "Транзитная комиссия" },
  { value: "adjustment", label: "Корректировка" },
] as const;

export type FinancialLineBucket = (typeof FINANCIAL_LINE_BUCKETS)[number];
export type FinancialLineSource = "rule" | "manual";
export type FinancialLineSettlementMode =
  | "in_ledger"
  | "separate_payment_order";

const currencySchema = z
  .string()
  .refine((value) => isValidCurrency(value), {
    message:
      "Currency must be 2-16 uppercase alphanumeric characters or underscores",
  })
  .transform((value) => normalizeCurrency(value));

export const financialLineBucketSchema = z.enum(FINANCIAL_LINE_BUCKETS);
export const financialLineSourceSchema = z.enum(["rule", "manual"]);
export const financialLineSettlementModeSchema = z.enum([
  "in_ledger",
  "separate_payment_order",
]);

export const financialLineSchema = z.object({
  id: z.string().trim().min(1).max(128),
  bucket: financialLineBucketSchema,
  currency: currencySchema,
  amountMinor: signedMinorAmountSchema,
  source: financialLineSourceSchema,
  settlementMode: financialLineSettlementModeSchema.optional(),
  memo: z.string().trim().max(1_000).optional(),
  metadata: z.record(z.string(), z.string().max(255)).optional(),
});

export type FinancialLine = z.infer<typeof financialLineSchema>;

function resolveSettlementMode(
  input: Pick<FinancialLine, "bucket" | "settlementMode">,
): FinancialLineSettlementMode {
  if (input.settlementMode) {
    return input.settlementMode;
  }

  return input.bucket === "pass_through"
    ? "separate_payment_order"
    : "in_ledger";
}

export function normalizeFinancialLine(input: FinancialLine): FinancialLine {
  const validated = financialLineSchema.parse(input);

  return {
    ...validated,
    settlementMode: resolveSettlementMode(validated),
  };
}

export function financialLineAggregateKey(line: FinancialLine): string {
  return [
    line.bucket,
    line.currency,
    line.source,
    line.settlementMode ?? "in_ledger",
    line.memo ?? "",
  ].join("|");
}

export function aggregateFinancialLines(
  lines: FinancialLine[],
): FinancialLine[] {
  const grouped = new Map<string, FinancialLine>();

  for (const raw of lines) {
    const line = normalizeFinancialLine(raw);
    const key = financialLineAggregateKey(line);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, line);
      continue;
    }

    const amountMinor = existing.amountMinor + line.amountMinor;
    if (amountMinor === 0n) {
      grouped.delete(key);
      continue;
    }

    grouped.set(key, {
      ...existing,
      amountMinor,
    });
  }

  return [...grouped.values()];
}
