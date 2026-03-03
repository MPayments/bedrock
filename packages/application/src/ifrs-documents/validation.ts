import { z } from "zod";

import { amountMinorSchema } from "@bedrock/core/documents/module-kit";

const currencyCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(16)
  .transform((value) => value.toUpperCase());

const memoSchema = z.string().trim().max(1_000).optional();
const referenceSchema = z.string().trim().min(1).max(255).optional();

const baseOccurredAtSchema = z.object({
  occurredAt: z.coerce.date(),
});

export const TransferIntraInputSchema = baseOccurredAtSchema.extend({
  sourceCounterpartyAccountId: z.uuid(),
  destinationCounterpartyAccountId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: memoSchema,
});

export const TransferIntercompanyInputSchema = TransferIntraInputSchema;

export const TransferIntraPayloadSchema = TransferIntraInputSchema.extend({
  sourceCounterpartyId: z.uuid(),
  destinationCounterpartyId: z.uuid(),
});

export const TransferIntercompanyPayloadSchema = TransferIntraPayloadSchema;

export const TransferResolutionInputSchema = baseOccurredAtSchema.extend({
  transferDocumentId: z.uuid(),
  resolutionType: z.enum(["settle", "void", "fail"]),
  eventIdempotencyKey: z.string().trim().min(1).max(255),
  pendingIndex: z.number().int().min(0).default(0),
  memo: memoSchema,
});

export const TransferResolutionPayloadSchema = TransferResolutionInputSchema;

export const CapitalFundingKindSchema = z.enum([
  "founder_equity",
  "investor_equity",
  "shareholder_loan",
  "opening_balance",
]);

export const CapitalFundingInputSchema = baseOccurredAtSchema.extend({
  kind: CapitalFundingKindSchema,
  entryRef: z.string().trim().min(1).max(255),
  counterpartyId: z.uuid(),
  counterpartyAccountId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  memo: memoSchema,
});

export const CapitalFundingPayloadSchema = CapitalFundingInputSchema;

export const IntercompanyLoanDrawdownSchema = baseOccurredAtSchema.extend({
  debtorCounterpartyId: z.uuid(),
  creditorCounterpartyId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const IntercompanyLoanRepaymentSchema =
  IntercompanyLoanDrawdownSchema;

export const IntercompanyInterestAccrualSchema =
  IntercompanyLoanDrawdownSchema.extend({
    accrualPeriodMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  });

export const IntercompanyInterestSettlementSchema =
  IntercompanyLoanDrawdownSchema;

export const EquityContributionSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  investorCounterpartyId: z.uuid().optional(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const EquityDistributionSchema = EquityContributionSchema;

const adjustmentSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const AccrualAdjustmentSchema = adjustmentSchema;
export const RevaluationAdjustmentSchema = adjustmentSchema;
export const ImpairmentAdjustmentSchema = adjustmentSchema;
export const ClosingReclassSchema = adjustmentSchema;

const periodBoundarySchema = z.coerce.date();

export const PeriodCloseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  periodStart: periodBoundarySchema,
  periodEnd: periodBoundarySchema,
  closeReason: z.string().trim().max(500).optional(),
});

export const PeriodReopenSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  periodStart: periodBoundarySchema,
  periodEnd: periodBoundarySchema.optional(),
  reopenReason: z.string().trim().max(500).optional(),
});

export type TransferIntraInput = z.infer<typeof TransferIntraInputSchema>;
export type TransferIntercompanyInput = z.infer<
  typeof TransferIntercompanyInputSchema
>;
export type TransferIntraPayload = z.infer<typeof TransferIntraPayloadSchema>;
export type TransferIntercompanyPayload = z.infer<
  typeof TransferIntercompanyPayloadSchema
>;
export type TransferResolutionInput = z.infer<typeof TransferResolutionInputSchema>;
export type TransferResolutionPayload = z.infer<
  typeof TransferResolutionPayloadSchema
>;
export type CapitalFundingInput = z.infer<typeof CapitalFundingInputSchema>;
export type CapitalFundingPayload = z.infer<typeof CapitalFundingPayloadSchema>;
export type IntercompanyLoanDrawdown = z.infer<
  typeof IntercompanyLoanDrawdownSchema
>;
export type IntercompanyLoanRepayment = z.infer<
  typeof IntercompanyLoanRepaymentSchema
>;
export type IntercompanyInterestAccrual = z.infer<
  typeof IntercompanyInterestAccrualSchema
>;
export type IntercompanyInterestSettlement = z.infer<
  typeof IntercompanyInterestSettlementSchema
>;
export type EquityContribution = z.infer<typeof EquityContributionSchema>;
export type EquityDistribution = z.infer<typeof EquityDistributionSchema>;
export type AccrualAdjustment = z.infer<typeof AccrualAdjustmentSchema>;
export type RevaluationAdjustment = z.infer<typeof RevaluationAdjustmentSchema>;
export type ImpairmentAdjustment = z.infer<typeof ImpairmentAdjustmentSchema>;
export type ClosingReclass = z.infer<typeof ClosingReclassSchema>;
export type PeriodClose = z.infer<typeof PeriodCloseSchema>;
export type PeriodReopen = z.infer<typeof PeriodReopenSchema>;
