import { z } from "zod";

import { OBLIGATION_KINDS, BENEFICIAL_OWNER_TYPES } from "../../shared/domain/taxonomy";
import {
  dateInputSchema,
  jsonRecordSchema,
  positiveMinorAmountStringSchema,
  uuidSchema,
} from "../../shared/application/zod";

export const ObligationKindSchema = z.enum(OBLIGATION_KINDS);
export const BeneficialOwnerTypeSchema = z.enum(BENEFICIAL_OWNER_TYPES);

export const ObligationSchema = z.object({
  id: uuidSchema,
  obligationKind: ObligationKindSchema,
  debtorEntityId: uuidSchema,
  creditorEntityId: uuidSchema,
  beneficialOwnerType: BeneficialOwnerTypeSchema.nullable(),
  beneficialOwnerId: uuidSchema.nullable(),
  assetId: uuidSchema,
  amountMinor: positiveMinorAmountStringSchema,
  settledMinor: z.string(),
  dueAt: dateInputSchema.nullable(),
  memo: z.string().trim().max(1_000).nullable(),
  payload: jsonRecordSchema.nullable(),
  createdAt: dateInputSchema,
  updatedAt: dateInputSchema,
});

export const OpenObligationInputSchema = ObligationSchema.omit({
  id: true,
  settledMinor: true,
  createdAt: true,
  updatedAt: true,
});

export const ObligationOutstandingSchema = z.object({
  obligationId: uuidSchema,
  obligationKind: ObligationKindSchema,
  assetId: uuidSchema,
  amountMinor: positiveMinorAmountStringSchema,
  settledMinor: z.string(),
  outstandingMinor: z.string(),
});

export type Obligation = z.infer<typeof ObligationSchema>;
export type OpenObligationInput = z.infer<typeof OpenObligationInputSchema>;
export type ObligationOutstanding = z.infer<typeof ObligationOutstandingSchema>;
