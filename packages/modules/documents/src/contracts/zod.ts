import { z } from "zod";

import {
  isValidCurrency,
  normalizeCurrency,
} from "@bedrock/currencies/contracts";
import { signedMinorAmountSchema } from "@bedrock/shared/money";

export const DOCUMENT_SUBMISSION_STATUSES = ["draft", "submitted"] as const;
export const DOCUMENT_APPROVAL_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
] as const;
export const DOCUMENT_POSTING_STATUSES = [
  "not_required",
  "unposted",
  "posting",
  "posted",
  "failed",
] as const;
export const DOCUMENT_LIFECYCLE_STATUSES = [
  "active",
  "cancelled",
] as const;

export const FINANCIAL_LINE_BUCKETS = [
  "fee_revenue",
  "spread_revenue",
  "provider_fee_expense",
  "pass_through",
  "adjustment",
] as const;

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
