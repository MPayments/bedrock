import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";
import { z } from "zod";

import {
  PaymentRouteDraftSchema,
  PaymentRouteLockedSideSchema,
  PaymentRouteParticipantRefSchema,
  PaymentRouteSnapshotPolicySchema,
  PaymentRouteTemplateStatusSchema,
  PaymentRouteVisualMetadataSchema,
} from "./zod";

const PaymentRouteCalculationFeeSharedSchema = z.object({
  amountMinor: z.string(),
  currencyId: z.uuid(),
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).optional(),
  outputImpactCurrencyId: z.uuid(),
  outputImpactMinor: z.string(),
});

const PaymentRouteCalculationPercentFeeSchema =
  PaymentRouteCalculationFeeSharedSchema.extend({
    kind: z.literal("percent"),
    percentage: z.string().trim().min(1),
  });

const PaymentRouteCalculationFixedFeeSchema =
  PaymentRouteCalculationFeeSharedSchema.extend({
    kind: z.literal("fixed"),
  });

export const PaymentRouteCalculationFeeSchema = z.discriminatedUnion("kind", [
  PaymentRouteCalculationPercentFeeSchema,
  PaymentRouteCalculationFixedFeeSchema,
]);

export const PaymentRouteCalculationLegSchema = z.object({
  asOf: z.iso.datetime(),
  fees: z.array(PaymentRouteCalculationFeeSchema),
  fromCurrencyId: z.uuid(),
  grossOutputMinor: z.string(),
  id: z.string(),
  idx: z.number().int().positive(),
  inputAmountMinor: z.string(),
  kind: z.string(),
  netOutputMinor: z.string(),
  rateDen: z.string(),
  rateNum: z.string(),
  rateSource: z.string(),
  toCurrencyId: z.uuid(),
});

export const PaymentRouteAmountTotalSchema = z.object({
  amountMinor: z.string(),
  currencyId: z.uuid(),
});

export const PaymentRouteCalculationSchema = z.object({
  additionalFees: z.array(PaymentRouteCalculationFeeSchema),
  amountInMinor: z.string(),
  amountOutMinor: z.string(),
  computedAt: z.iso.datetime(),
  currencyInId: z.uuid(),
  currencyOutId: z.uuid(),
  feeTotals: z.array(PaymentRouteAmountTotalSchema),
  grossAmountOutMinor: z.string(),
  legs: z.array(PaymentRouteCalculationLegSchema),
  lockedSide: PaymentRouteLockedSideSchema,
  netAmountOutMinor: z.string(),
});

export const PaymentRouteTemplateSchema = z.object({
  createdAt: z.iso.datetime(),
  draft: PaymentRouteDraftSchema,
  id: z.uuid(),
  lastCalculation: PaymentRouteCalculationSchema.nullable(),
  name: z.string(),
  snapshotPolicy: PaymentRouteSnapshotPolicySchema,
  status: PaymentRouteTemplateStatusSchema,
  updatedAt: z.iso.datetime(),
  visual: PaymentRouteVisualMetadataSchema,
});

export const PaymentRouteTemplateListItemSchema = z.object({
  createdAt: z.iso.datetime(),
  currencyInId: z.uuid(),
  currencyOutId: z.uuid(),
  destinationParticipant: PaymentRouteParticipantRefSchema,
  hopCount: z.number().int().nonnegative(),
  id: z.uuid(),
  lastCalculation: PaymentRouteCalculationSchema.nullable(),
  name: z.string(),
  snapshotPolicy: PaymentRouteSnapshotPolicySchema,
  sourceParticipant: PaymentRouteParticipantRefSchema,
  status: PaymentRouteTemplateStatusSchema,
  updatedAt: z.iso.datetime(),
});

export const PaymentRouteTemplateListResponseSchema =
  createPaginatedListSchema(PaymentRouteTemplateListItemSchema);

export type PaymentRouteCalculationFee = z.infer<
  typeof PaymentRouteCalculationFeeSchema
>;
export type PaymentRouteCalculationLeg = z.infer<
  typeof PaymentRouteCalculationLegSchema
>;
export type PaymentRouteAmountTotal = z.infer<
  typeof PaymentRouteAmountTotalSchema
>;
export type PaymentRouteCalculation = z.infer<
  typeof PaymentRouteCalculationSchema
>;
export type PaymentRouteTemplate = z.infer<typeof PaymentRouteTemplateSchema>;
export type PaymentRouteTemplateListItem = z.infer<
  typeof PaymentRouteTemplateListItemSchema
>;
export type PaymentRouteTemplateListResponse = z.infer<
  typeof PaymentRouteTemplateListResponseSchema
>;
