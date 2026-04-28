import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import {
  PaymentRouteDraftSchema,
  PaymentRouteFeeApplicationSchema,
  PaymentRouteFeeKindSchema,
  PaymentRouteLockedSideSchema,
  PaymentRouteParticipantRefSchema,
  PaymentRouteSnapshotPolicySchema,
  PaymentRouteTemplateStatusSchema,
  PaymentRouteVisualMetadataSchema,
} from "./zod";

const PaymentRouteCalculationFeeSharedSchema = z.object({
  amountMinor: z.string(),
  application: PaymentRouteFeeApplicationSchema,
  currencyId: z.uuid(),
  id: z.string().trim().min(1),
  inputImpactCurrencyId: z.uuid(),
  inputImpactMinor: z.string(),
  label: z.string().trim().min(1).optional(),
  outputImpactCurrencyId: z.uuid(),
  outputImpactMinor: z.string(),
  routeInputImpactMinor: z.string(),
});

const PaymentRouteExecutionCostTreatmentSchema = z.enum([
  "execution_spread",
  "flow_deduction",
  "separate_expense",
]);

const PaymentRouteExecutionCostLineSchema = z.object({
  amountMinor: z.string(),
  application: PaymentRouteFeeApplicationSchema,
  currencyId: z.uuid(),
  id: z.string().trim().min(1),
  inputImpactCurrencyId: z.uuid(),
  inputImpactMinor: z.string(),
  kind: PaymentRouteFeeKindSchema,
  label: z.string().trim().min(1).optional(),
  location: z.enum(["additional", "leg"]),
  outputImpactCurrencyId: z.uuid(),
  outputImpactMinor: z.string(),
  routeInputImpactMinor: z.string(),
  treatment: PaymentRouteExecutionCostTreatmentSchema,
});

const PaymentRouteCalculationGrossPercentFeeSchema =
  PaymentRouteCalculationFeeSharedSchema.extend({
    kind: z.literal("gross_percent"),
    percentage: z.string().trim().min(1),
  });

const PaymentRouteCalculationNetPercentFeeSchema =
  PaymentRouteCalculationFeeSharedSchema.extend({
    kind: z.literal("net_percent"),
    percentage: z.string().trim().min(1),
  });

const PaymentRouteCalculationFxSpreadFeeSchema =
  PaymentRouteCalculationFeeSharedSchema.extend({
    kind: z.literal("fx_spread"),
    percentage: z.string().trim().min(1),
  });

const PaymentRouteCalculationFixedFeeSchema =
  PaymentRouteCalculationFeeSharedSchema.extend({
    kind: z.literal("fixed"),
  });

export const PaymentRouteCalculationFeeSchema = z.discriminatedUnion("kind", [
  PaymentRouteCalculationGrossPercentFeeSchema,
  PaymentRouteCalculationNetPercentFeeSchema,
  PaymentRouteCalculationFxSpreadFeeSchema,
  PaymentRouteCalculationFixedFeeSchema,
]);

export const PaymentRouteCalculationLegSchema = z
  .object({
    asOf: z.iso.datetime(),
    fees: z.array(PaymentRouteCalculationFeeSchema),
    fromCurrencyId: z.uuid(),
    grossOutputMinor: z.string(),
    id: z.string(),
    idx: z.number().int().positive(),
    inputAmountMinor: z.string(),
    netOutputMinor: z.string(),
    rateDen: z.string(),
    rateNum: z.string(),
    rateSource: z.string(),
    toCurrencyId: z.uuid(),
  })
  .strict();

export const PaymentRouteAmountTotalSchema = z.object({
  amountMinor: z.string(),
  currencyId: z.uuid(),
});

export const PaymentRouteCalculationSchema = z.object({
  additionalFees: z.array(PaymentRouteCalculationFeeSchema),
  amountInMinor: z.string(),
  amountOutMinor: z.string(),
  benchmarkPrincipalInMinor: z.string(),
  cleanAmountOutMinor: z.string(),
  computedAt: z.iso.datetime(),
  costPriceInMinor: z.string(),
  currencyInId: z.uuid(),
  currencyOutId: z.uuid(),
  deductedExecutionCostMinor: z.string(),
  embeddedExecutionCostMinor: z.string(),
  executionCostLines: z.array(PaymentRouteExecutionCostLineSchema),
  executionPrincipalInMinor: z.string(),
  feeTotals: z.array(PaymentRouteAmountTotalSchema),
  grossAmountOutMinor: z.string(),
  internalFeeTotals: z.array(PaymentRouteAmountTotalSchema),
  legs: z.array(PaymentRouteCalculationLegSchema),
  lockedSide: PaymentRouteLockedSideSchema,
  netAmountOutMinor: z.string(),
  separateExecutionCostMinor: z.string(),
});

export const PaymentRouteTemplateSchema = z
  .object({
    createdAt: z.iso.datetime(),
    draft: PaymentRouteDraftSchema,
    id: z.uuid(),
    lastCalculation: PaymentRouteCalculationSchema.nullable(),
    maxMarginBps: z.number().int().nonnegative().nullable().default(null),
    minMarginBps: z.number().int().nonnegative().nullable().default(null),
    name: z.string(),
    snapshotPolicy: PaymentRouteSnapshotPolicySchema,
    status: PaymentRouteTemplateStatusSchema,
    updatedAt: z.iso.datetime(),
    visual: PaymentRouteVisualMetadataSchema,
  })
  .superRefine((value, context) => {
    if (
      value.minMarginBps !== null &&
      value.maxMarginBps !== null &&
      value.minMarginBps > value.maxMarginBps
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minMarginBps must not exceed maxMarginBps",
        path: ["minMarginBps"],
      });
    }
  });

export const PaymentRouteTemplateListItemSchema = z.object({
  createdAt: z.iso.datetime(),
  currencyInId: z.uuid(),
  currencyOutId: z.uuid(),
  destinationEndpoint: PaymentRouteParticipantRefSchema,
  hopCount: z.number().int().nonnegative(),
  id: z.uuid(),
  lastCalculation: PaymentRouteCalculationSchema.nullable(),
  name: z.string(),
  snapshotPolicy: PaymentRouteSnapshotPolicySchema,
  sourceEndpoint: PaymentRouteParticipantRefSchema,
  status: PaymentRouteTemplateStatusSchema,
  updatedAt: z.iso.datetime(),
});

export const PaymentRouteTemplateListResponseSchema =
  createPaginatedListSchema(PaymentRouteTemplateListItemSchema);

export type {
  PaymentRouteAmountTotal,
  PaymentRouteCalculation,
  PaymentRouteCalculationFee,
  PaymentRouteCalculationLeg,
} from "../../domain/model";
export type PaymentRouteTemplate = z.infer<typeof PaymentRouteTemplateSchema>;
export type PaymentRouteTemplateListItem = z.infer<
  typeof PaymentRouteTemplateListItemSchema
>;
export type PaymentRouteTemplateListResponse = z.infer<
  typeof PaymentRouteTemplateListResponseSchema
>;
