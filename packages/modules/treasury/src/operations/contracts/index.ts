import { z } from "zod";

import {
  BENEFICIAL_OWNER_TYPES,
  INSTRUCTION_STATUSES,
  LEGAL_BASES,
  LEG_KINDS,
  OPERATION_KINDS,
  SETTLEMENT_MODELS,
} from "../../shared/domain/taxonomy";
import {
  jsonRecordSchema,
  positiveMinorAmountStringSchema,
  uuidSchema,
  dateInputSchema,
} from "../../shared/application/zod";
import { ExecutionEventSchema, ExecutionInstructionSchema } from "../../executions/contracts";
import { ObligationSchema } from "../../obligations/contracts";
import { TreasuryPositionSchema } from "../../positions/contracts";

export const OperationKindSchema = z.enum(OPERATION_KINDS);
export const LegalBasisSchema = z.enum(LEGAL_BASES);
export const SettlementModelSchema = z.enum(SETTLEMENT_MODELS);
export const InstructionStatusSchema = z.enum(INSTRUCTION_STATUSES);
export const BeneficialOwnerTypeSchema = z.enum(BENEFICIAL_OWNER_TYPES);
export const LegKindSchema = z.enum(LEG_KINDS);

export const FeeLineSchema = z.object({
  legKind: LegKindSchema,
  assetId: uuidSchema,
  amountMinor: positiveMinorAmountStringSchema,
});

export const QuoteSnapshotSchema = z.object({
  quoteId: uuidSchema,
  sourceAssetId: uuidSchema,
  destinationAssetId: uuidSchema,
  sourceAmountMinor: positiveMinorAmountStringSchema,
  destinationAmountMinor: positiveMinorAmountStringSchema,
  payload: jsonRecordSchema,
});

const TreasuryOperationBaseSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(255),
  economicOwnerEntityId: uuidSchema,
  executingEntityId: uuidSchema,
  cashHolderEntityId: uuidSchema.optional(),
  beneficialOwnerType: BeneficialOwnerTypeSchema.optional(),
  beneficialOwnerId: uuidSchema.optional(),
  obligationIds: z.array(uuidSchema).default([]),
  memo: z.string().trim().max(1_000).nullable().optional(),
});

const MoneyMovementSchema = TreasuryOperationBaseSchema.extend({
  sourceAccountId: uuidSchema,
  assetId: uuidSchema,
  amountMinor: positiveMinorAmountStringSchema,
});

export const IssueOperationInputSchema = z.discriminatedUnion("operationKind", [
  MoneyMovementSchema.extend({
    operationKind: z.literal("payout"),
  }),
  MoneyMovementSchema.extend({
    operationKind: z.literal("collection"),
  }),
  MoneyMovementSchema.extend({
    operationKind: z.literal("intracompany_transfer"),
    destinationAccountId: uuidSchema,
  }),
  MoneyMovementSchema.extend({
    operationKind: z.literal("intercompany_funding"),
    destinationAccountId: uuidSchema,
    legalBasis: LegalBasisSchema,
  }),
  TreasuryOperationBaseSchema.extend({
    operationKind: z.literal("fx_conversion"),
    sourceAccountId: uuidSchema,
    destinationAccountId: uuidSchema,
    sourceAssetId: uuidSchema,
    destinationAssetId: uuidSchema,
    sourceAmountMinor: positiveMinorAmountStringSchema,
    destinationAmountMinor: positiveMinorAmountStringSchema,
    quoteSnapshot: QuoteSnapshotSchema,
    feeLines: z.array(FeeLineSchema).default([]),
  }),
  MoneyMovementSchema.extend({
    operationKind: z.literal("sweep"),
    destinationAccountId: uuidSchema,
  }),
  MoneyMovementSchema.extend({
    operationKind: z.literal("return"),
    legalBasis: LegalBasisSchema.optional(),
  }),
  MoneyMovementSchema.extend({
    operationKind: z.literal("adjustment"),
    legalBasis: LegalBasisSchema.optional(),
  }),
]);

export const ApproveOperationInputSchema = z.object({
  operationId: uuidSchema,
});

export const ReserveOperationFundsInputSchema = z.object({
  operationId: uuidSchema,
});

export const TreasuryOperationSchema = z.object({
  id: uuidSchema,
  idempotencyKey: z.string(),
  operationKind: OperationKindSchema,
  economicOwnerEntityId: uuidSchema,
  executingEntityId: uuidSchema,
  cashHolderEntityId: uuidSchema.nullable(),
  beneficialOwnerType: BeneficialOwnerTypeSchema.nullable(),
  beneficialOwnerId: uuidSchema.nullable(),
  legalBasis: LegalBasisSchema.nullable(),
  settlementModel: SettlementModelSchema,
  instructionStatus: InstructionStatusSchema,
  sourceAccountId: uuidSchema.nullable(),
  destinationAccountId: uuidSchema.nullable(),
  sourceAssetId: uuidSchema.nullable(),
  destinationAssetId: uuidSchema.nullable(),
  sourceAmountMinor: z.string().nullable(),
  destinationAmountMinor: z.string().nullable(),
  memo: z.string().nullable(),
  payload: jsonRecordSchema.nullable(),
  createdAt: dateInputSchema,
  updatedAt: dateInputSchema,
  approvedAt: dateInputSchema.nullable(),
  reservedAt: dateInputSchema.nullable(),
});

export const ListTreasuryOperationsInputSchema = z.object({
  operationKind: OperationKindSchema.optional(),
  instructionStatus: InstructionStatusSchema.optional(),
  entityId: uuidSchema.optional(),
  assetId: uuidSchema.optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const OperationTimelineItemSchema = z.object({
  operation: TreasuryOperationSchema,
  obligations: z.array(uuidSchema),
  obligationItems: z.array(ObligationSchema),
  instructions: z.array(uuidSchema),
  instructionItems: z.array(ExecutionInstructionSchema),
  events: z.array(uuidSchema),
  eventItems: z.array(ExecutionEventSchema),
  positions: z.array(uuidSchema),
  positionItems: z.array(TreasuryPositionSchema),
});

export const GetOperationTimelineInputSchema = z.object({
  operationId: uuidSchema,
});

export type FeeLine = z.infer<typeof FeeLineSchema>;
export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;
export type IssueOperationInput = z.infer<typeof IssueOperationInputSchema>;
export type ApproveOperationInput = z.infer<typeof ApproveOperationInputSchema>;
export type ReserveOperationFundsInput = z.infer<
  typeof ReserveOperationFundsInputSchema
>;
export type TreasuryOperation = z.infer<typeof TreasuryOperationSchema>;
export type ListTreasuryOperationsInput = z.infer<
  typeof ListTreasuryOperationsInputSchema
>;
export type OperationTimelineItem = z.infer<typeof OperationTimelineItemSchema>;
export type GetOperationTimelineInput = z.infer<
  typeof GetOperationTimelineInputSchema
>;
