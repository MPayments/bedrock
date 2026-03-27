import { z } from "zod";

import { BENEFICIAL_OWNER_TYPES, POSITION_KINDS } from "../../shared/domain/taxonomy";
import {
  dateInputSchema,
  positiveMinorAmountStringSchema,
  uuidSchema,
} from "../../shared/application/zod";

export const PositionKindSchema = z.enum(POSITION_KINDS);
export const BeneficialOwnerTypeSchema = z.enum(BENEFICIAL_OWNER_TYPES);

export const TreasuryPositionSchema = z.object({
  id: uuidSchema,
  originOperationId: uuidSchema.nullable(),
  positionKind: PositionKindSchema,
  ownerEntityId: uuidSchema,
  counterpartyEntityId: uuidSchema.nullable(),
  beneficialOwnerType: BeneficialOwnerTypeSchema.nullable(),
  beneficialOwnerId: uuidSchema.nullable(),
  assetId: uuidSchema,
  amountMinor: z.string(),
  settledMinor: z.string(),
  createdAt: dateInputSchema,
  updatedAt: dateInputSchema,
  closedAt: dateInputSchema.nullable(),
});

export const ListTreasuryPositionsInputSchema = z.object({
  originOperationId: uuidSchema.optional(),
  ownerEntityId: uuidSchema.optional(),
  beneficialOwnerType: BeneficialOwnerTypeSchema.optional(),
  beneficialOwnerId: uuidSchema.optional(),
});

export const SettlePositionInputSchema = z.object({
  positionId: uuidSchema,
  amountMinor: positiveMinorAmountStringSchema,
});

export type TreasuryPosition = z.infer<typeof TreasuryPositionSchema>;
export type ListTreasuryPositionsInput = z.infer<
  typeof ListTreasuryPositionsInputSchema
>;
export type SettlePositionInput = z.infer<typeof SettlePositionInputSchema>;
