import { z } from "zod";

import {
  PaymentStepPartyRefSchema,
  PaymentStepRateSchema,
} from "../../payment-steps/contracts/dto";
import { PAYMENT_STEP_KIND_VALUES } from "../../payment-steps/domain/types";
import {
  TREASURY_ORDER_STATE_VALUES,
  TREASURY_ORDER_TYPE_VALUES,
} from "../domain/types";

export const TreasuryOrderTypeSchema = z.enum(TREASURY_ORDER_TYPE_VALUES);
export const TreasuryOrderStateSchema = z.enum(TREASURY_ORDER_STATE_VALUES);
const TREASURY_ORDER_STEP_KIND_VALUES = [
  ...PAYMENT_STEP_KIND_VALUES,
  "quote_execution",
] as const;
export const TreasuryOrderStepKindSchema = z.enum(
  TREASURY_ORDER_STEP_KIND_VALUES,
);

const OptionalAmountMinorSchema =
  z.bigint().positive().nullable().optional().default(null);

export const TreasuryOrderStepPlanInputSchema = z.object({
  fromAmountMinor: OptionalAmountMinorSchema,
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  kind: TreasuryOrderStepKindSchema,
  quoteId: z.uuid().nullable().optional().default(null),
  rate: PaymentStepRateSchema.nullable().optional().default(null),
  toAmountMinor: OptionalAmountMinorSchema,
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
});

export const CreateTreasuryOrderInputSchema = z.object({
  description: z.string().trim().max(1000).nullable().optional().default(null),
  id: z.uuid().optional(),
  steps: z.array(TreasuryOrderStepPlanInputSchema).min(1),
  type: TreasuryOrderTypeSchema,
});

export const GetTreasuryOrderByIdInputSchema = z.object({
  orderId: z.uuid(),
});

export const ListTreasuryOrdersQuerySchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  state: TreasuryOrderStateSchema.optional(),
  type: TreasuryOrderTypeSchema.optional(),
});

export const TreasuryOrderStepSchema = TreasuryOrderStepPlanInputSchema.extend({
  createdAt: z.date(),
  id: z.uuid(),
  paymentStepId: z.uuid().nullable(),
  quoteExecutionId: z.uuid().nullable(),
  sequence: z.number().int().positive(),
  sourceRef: z.string(),
  updatedAt: z.date(),
});

export const TreasuryOrderSchema = z.object({
  activatedAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  createdAt: z.date(),
  description: z.string().nullable(),
  id: z.uuid(),
  state: TreasuryOrderStateSchema,
  steps: z.array(TreasuryOrderStepSchema),
  type: TreasuryOrderTypeSchema,
  updatedAt: z.date(),
});

export type CreateTreasuryOrderInput = z.infer<
  typeof CreateTreasuryOrderInputSchema
>;
export type GetTreasuryOrderByIdInput = z.infer<
  typeof GetTreasuryOrderByIdInputSchema
>;
export type ListTreasuryOrdersQuery = z.infer<
  typeof ListTreasuryOrdersQuerySchema
>;
export type TreasuryOrder = z.infer<typeof TreasuryOrderSchema>;
export type TreasuryOrderState = z.infer<typeof TreasuryOrderStateSchema>;
export type TreasuryOrderStepKind = z.infer<typeof TreasuryOrderStepKindSchema>;
export type TreasuryOrderType = z.infer<typeof TreasuryOrderTypeSchema>;
