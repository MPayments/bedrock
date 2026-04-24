import { z } from "zod";

export const EXECUTION_AMENDMENT_REASONS = [
  "counterparty_unavailable",
  "requisite_invalid",
  "intermediary_swap",
  "fee_correction",
  "typo_correction",
  "other",
] as const;

export const COMMERCIAL_AMENDMENT_REASONS = [
  "market_moved",
  "customer_renegotiation",
  "pricing_error",
  "other",
] as const;

export const ExecutionAmendmentReasonSchema = z.enum(
  EXECUTION_AMENDMENT_REASONS,
);
export const CommercialAmendmentReasonSchema = z.enum(
  COMMERCIAL_AMENDMENT_REASONS,
);

export type ExecutionAmendmentReason = z.infer<
  typeof ExecutionAmendmentReasonSchema
>;
export type CommercialAmendmentReason = z.infer<
  typeof CommercialAmendmentReasonSchema
>;

export const DEAL_AMENDMENT_KIND_VALUES = ["execution", "commercial"] as const;

export const DealAmendmentKindSchema = z.enum(DEAL_AMENDMENT_KIND_VALUES);

export type DealAmendmentKind = z.infer<typeof DealAmendmentKindSchema>;

export function validateAmendmentReason(
  kind: DealAmendmentKind,
  reasonCode: string,
): void {
  const parsed =
    kind === "execution"
      ? ExecutionAmendmentReasonSchema.safeParse(reasonCode)
      : CommercialAmendmentReasonSchema.safeParse(reasonCode);

  if (!parsed.success) {
    throw new Error(`Invalid reason code "${reasonCode}" for ${kind} amendment`);
  }
}
