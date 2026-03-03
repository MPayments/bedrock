import { z } from "zod";

import {
  amountMinorSchema,
  amountValueSchema,
  toMinorAmountString,
} from "@bedrock/core/documents/module-kit";

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

function withAmountMinor<TInput extends { amount: string; currency: string }>(
  input: TInput,
  ctx: z.RefinementCtx,
) {
  try {
    const amountMinor = toMinorAmountString(input.amount, input.currency, {
      requirePositive: true,
    });
    const { amount: _amount, ...rest } = input;
    return {
      ...rest,
      amountMinor,
    };
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "amount is invalid",
    });
    return z.NEVER;
  }
}

const transferInputBaseSchema = baseOccurredAtSchema.extend({
  sourceCounterpartyAccountId: z.uuid(),
  destinationCounterpartyAccountId: z.uuid(),
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: memoSchema,
});

const transferPayloadBaseSchema = baseOccurredAtSchema.extend({
  sourceCounterpartyAccountId: z.uuid(),
  destinationCounterpartyAccountId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: memoSchema,
});

export const TransferIntraInputSchema = transferInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const TransferIntercompanyInputSchema = TransferIntraInputSchema;

export const TransferIntraPayloadSchema = transferPayloadBaseSchema.extend({
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

const capitalFundingInputBaseSchema = baseOccurredAtSchema.extend({
  kind: CapitalFundingKindSchema,
  entryRef: z.string().trim().min(1).max(255),
  counterpartyId: z.uuid(),
  counterpartyAccountId: z.uuid(),
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  memo: memoSchema,
});

export const CapitalFundingInputSchema = capitalFundingInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const CapitalFundingPayloadSchema = baseOccurredAtSchema.extend({
  kind: CapitalFundingKindSchema,
  entryRef: z.string().trim().min(1).max(255),
  counterpartyId: z.uuid(),
  counterpartyAccountId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  memo: memoSchema,
});

const intercompanyLoanInputBaseSchema = baseOccurredAtSchema.extend({
  debtorCounterpartyId: z.uuid(),
  creditorCounterpartyId: z.uuid(),
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

const intercompanyLoanPayloadBaseSchema = baseOccurredAtSchema.extend({
  debtorCounterpartyId: z.uuid(),
  creditorCounterpartyId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const IntercompanyLoanDrawdownInputSchema =
  intercompanyLoanInputBaseSchema.transform((input, ctx) =>
    withAmountMinor(input, ctx),
  );

export const IntercompanyLoanDrawdownSchema = intercompanyLoanPayloadBaseSchema;

export const IntercompanyLoanRepaymentInputSchema =
  IntercompanyLoanDrawdownInputSchema;

export const IntercompanyLoanRepaymentSchema = IntercompanyLoanDrawdownSchema;

const intercompanyInterestAccrualInputBaseSchema =
  intercompanyLoanInputBaseSchema.extend({
    accrualPeriodMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  });

export const IntercompanyInterestAccrualInputSchema =
  intercompanyInterestAccrualInputBaseSchema.transform((input, ctx) =>
    withAmountMinor(input, ctx),
  );

export const IntercompanyInterestAccrualSchema =
  intercompanyLoanPayloadBaseSchema.extend({
    accrualPeriodMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  });

export const IntercompanyInterestSettlementInputSchema =
  IntercompanyLoanDrawdownInputSchema;

export const IntercompanyInterestSettlementSchema =
  IntercompanyLoanDrawdownSchema;

const equityContributionInputBaseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  investorCounterpartyId: z.uuid().optional(),
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const EquityContributionInputSchema = equityContributionInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const EquityContributionSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  investorCounterpartyId: z.uuid().optional(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const EquityDistributionInputSchema = EquityContributionInputSchema;

export const EquityDistributionSchema = EquityContributionSchema;

const adjustmentInputBaseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

const adjustmentPayloadBaseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const AccrualAdjustmentInputSchema = adjustmentInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const RevaluationAdjustmentInputSchema = AccrualAdjustmentInputSchema;
export const ImpairmentAdjustmentInputSchema = AccrualAdjustmentInputSchema;
export const ClosingReclassInputSchema = AccrualAdjustmentInputSchema;

export const AccrualAdjustmentSchema = adjustmentPayloadBaseSchema;
export const RevaluationAdjustmentSchema = adjustmentPayloadBaseSchema;
export const ImpairmentAdjustmentSchema = adjustmentPayloadBaseSchema;
export const ClosingReclassSchema = adjustmentPayloadBaseSchema;

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
