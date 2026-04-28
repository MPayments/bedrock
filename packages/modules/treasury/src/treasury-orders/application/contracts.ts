import { z } from "zod";

import {
  PaymentStepPartyRefSchema,
  PaymentStepRateSchema,
} from "../../payment-steps/contracts/dto";
import { PAYMENT_STEP_KIND_VALUES } from "../../payment-steps/domain/types";
import {
  TREASURY_INVENTORY_ALLOCATION_STATE_VALUES,
  TREASURY_INVENTORY_POSITION_STATE_VALUES,
  TREASURY_ORDER_STATE_VALUES,
  TREASURY_ORDER_TYPE_VALUES,
} from "../domain/types";

export const TreasuryOrderTypeSchema = z.enum(TREASURY_ORDER_TYPE_VALUES);
export const TreasuryOrderStateSchema = z.enum(TREASURY_ORDER_STATE_VALUES);
export const TreasuryInventoryPositionStateSchema = z.enum(
  TREASURY_INVENTORY_POSITION_STATE_VALUES,
);
export const TreasuryInventoryAllocationStateSchema = z.enum(
  TREASURY_INVENTORY_ALLOCATION_STATE_VALUES,
);
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

export const GetInventoryPositionByIdInputSchema = z.object({
  positionId: z.uuid(),
});

export const GetReservedAllocationByDealAndQuoteInputSchema = z.object({
  dealId: z.uuid(),
  quoteId: z.uuid(),
});

export const ListTreasuryOrdersQuerySchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  state: TreasuryOrderStateSchema.optional(),
  type: TreasuryOrderTypeSchema.optional(),
});

export const TreasuryInventoryPositionSchema = z.object({
  acquiredAmountMinor: z.bigint().positive(),
  availableAmountMinor: z.bigint().nonnegative(),
  costAmountMinor: z.bigint().positive(),
  costCurrencyId: z.uuid(),
  createdAt: z.date(),
  currencyId: z.uuid(),
  id: z.uuid(),
  ledgerSubjectType: z.literal("organization_requisite"),
  ownerBookId: z.uuid(),
  ownerPartyId: z.uuid(),
  ownerRequisiteId: z.uuid(),
  sourceOrderId: z.uuid(),
  sourcePostingDocumentId: z.uuid(),
  sourcePostingDocumentKind: z.literal("fx_execute"),
  sourceQuoteExecutionId: z.uuid(),
  state: TreasuryInventoryPositionStateSchema,
  updatedAt: z.date(),
});

export const TreasuryInventoryAllocationSchema = z.object({
  amountMinor: z.bigint().positive(),
  costAmountMinor: z.bigint().nonnegative(),
  consumedAt: z.date().nullable(),
  createdAt: z.date(),
  currencyId: z.uuid(),
  dealId: z.uuid(),
  id: z.uuid(),
  ledgerHoldRef: z.string().min(1),
  ownerBookId: z.uuid(),
  ownerRequisiteId: z.uuid(),
  positionId: z.uuid(),
  quoteId: z.uuid().nullable(),
  releasedAt: z.date().nullable(),
  reservedAt: z.date(),
  state: TreasuryInventoryAllocationStateSchema,
  updatedAt: z.date(),
});

export const CreateInventoryPositionFromQuoteExecutionInputSchema = z.object({
  executionId: z.uuid(),
  id: z.uuid().optional(),
  ownerBookId: z.uuid(),
  sourcePostingDocumentId: z.uuid(),
  sourcePostingDocumentKind: z.literal("fx_execute"),
});

export const ReserveInventoryAllocationInputSchema = z.object({
  amountMinor: z.bigint().positive(),
  dealId: z.uuid(),
  id: z.uuid().optional(),
  positionId: z.uuid(),
  quoteId: z.uuid().nullable().optional().default(null),
});

export const InventoryAllocationActionInputSchema = z.object({
  allocationId: z.uuid(),
});

export const ListInventoryPositionsQuerySchema = z.object({
  currencyId: z.uuid().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  ownerPartyId: z.uuid().optional(),
  sourceOrderId: z.uuid().optional(),
  sourceQuoteExecutionId: z.uuid().optional(),
  state: TreasuryInventoryPositionStateSchema.optional(),
});

export const ListInventoryAllocationsQuerySchema = z.object({
  dealId: z.uuid().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  positionId: z.uuid().optional(),
  quoteId: z.uuid().optional(),
  state: TreasuryInventoryAllocationStateSchema.optional(),
});

const TreasuryOrderStepSchema = TreasuryOrderStepPlanInputSchema.extend({
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
export type GetInventoryPositionByIdInput = z.infer<
  typeof GetInventoryPositionByIdInputSchema
>;
export type GetReservedAllocationByDealAndQuoteInput = z.infer<
  typeof GetReservedAllocationByDealAndQuoteInputSchema
>;
export type ListTreasuryOrdersQuery = z.infer<
  typeof ListTreasuryOrdersQuerySchema
>;
export type CreateInventoryPositionFromQuoteExecutionInput = z.infer<
  typeof CreateInventoryPositionFromQuoteExecutionInputSchema
>;
export type ReserveInventoryAllocationInput = z.infer<
  typeof ReserveInventoryAllocationInputSchema
>;
export type InventoryAllocationActionInput = z.infer<
  typeof InventoryAllocationActionInputSchema
>;
export type ListInventoryPositionsQuery = z.infer<
  typeof ListInventoryPositionsQuerySchema
>;
export type ListInventoryAllocationsQuery = z.infer<
  typeof ListInventoryAllocationsQuerySchema
>;
export type TreasuryOrder = z.infer<typeof TreasuryOrderSchema>;
export type TreasuryInventoryAllocation = z.infer<
  typeof TreasuryInventoryAllocationSchema
>;
export type TreasuryInventoryAllocationState = z.infer<
  typeof TreasuryInventoryAllocationStateSchema
>;
export type TreasuryInventoryPosition = z.infer<
  typeof TreasuryInventoryPositionSchema
>;
export type TreasuryInventoryPositionState = z.infer<
  typeof TreasuryInventoryPositionStateSchema
>;
export type TreasuryOrderState = z.infer<typeof TreasuryOrderStateSchema>;
export type TreasuryOrderStepKind = z.infer<typeof TreasuryOrderStepKindSchema>;
export type TreasuryOrderType = z.infer<typeof TreasuryOrderTypeSchema>;
