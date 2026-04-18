import { z } from "zod";

import {
  PaymentRouteCalculationSchema,
  PaymentRouteDraftSchema,
  PaymentRouteLockedSideSchema,
  PaymentRouteSnapshotPolicySchema,
  type PaymentRouteCalculation,
  type PaymentRouteDraft,
} from "@bedrock/calculations/contracts";

export const DealRoutePlanTemplateRefSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  snapshotPolicy: PaymentRouteSnapshotPolicySchema,
  updatedAt: z.iso.datetime(),
});

export const DealRoutePlanExecutionSeedSchema = z.object({
  amountInMinor: z.string(),
  amountOutMinor: z.string(),
  currencyInId: z.uuid(),
  currencyOutId: z.uuid(),
  lockedSide: PaymentRouteLockedSideSchema,
});

export const DealRoutePlanSnapshotSchema = z.object({
  executionSeed: DealRoutePlanExecutionSeedSchema,
  frozenDraft: PaymentRouteDraftSchema,
  lastPreview: PaymentRouteCalculationSchema.nullable(),
  selectedTemplate: DealRoutePlanTemplateRefSchema.nullable(),
});

export type DealRoutePlanTemplateRef = z.infer<
  typeof DealRoutePlanTemplateRefSchema
>;
export type DealRoutePlanExecutionSeed = z.infer<
  typeof DealRoutePlanExecutionSeedSchema
>;
export type DealRoutePlanSnapshot = z.infer<typeof DealRoutePlanSnapshotSchema>;

export function createDealRoutePlanSnapshot(input: {
  frozenDraft: PaymentRouteDraft;
  lastPreview?: PaymentRouteCalculation | null;
  selectedTemplate?: DealRoutePlanTemplateRef | null;
}): DealRoutePlanSnapshot {
  return DealRoutePlanSnapshotSchema.parse({
    executionSeed: {
      amountInMinor: input.frozenDraft.amountInMinor,
      amountOutMinor: input.frozenDraft.amountOutMinor,
      currencyInId: input.frozenDraft.currencyInId,
      currencyOutId: input.frozenDraft.currencyOutId,
      lockedSide: input.frozenDraft.lockedSide,
    },
    frozenDraft: input.frozenDraft,
    lastPreview: input.lastPreview ?? null,
    selectedTemplate: input.selectedTemplate ?? null,
  });
}
