import { z } from "zod";

import {
  TreasuryCashMovementDirectionSchema,
  TreasuryOperationFactSourceKindSchema,
  TreasuryOperationKindSchema,
  TreasuryOperationStateSchema,
} from "./zod";
import {
  TreasuryInstructionActionsSchema,
  TreasuryInstructionAvailableOutcomeTransitionsSchema,
  TreasuryInstructionSchema,
} from "../../../instructions/application/contracts/dto";

const TreasuryOperationFinanceQueueSchema = z.enum([
  "funding",
  "execution",
  "failed_instruction",
]);

const TreasuryOperationDealTypeSchema = z.enum([
  "payment",
  "currency_exchange",
  "currency_transit",
  "exporter_settlement",
  "internal_treasury",
]);

const TreasuryOperationLegKindSchema = z.enum([
  "collect",
  "convert",
  "payout",
  "transit_hold",
  "settle_exporter",
]);

export const TreasuryOperationSchema = z.object({
  amountMinor: z.string().nullable(),
  counterAmountMinor: z.string().nullable(),
  counterCurrencyId: z.uuid().nullable(),
  createdAt: z.date(),
  currencyId: z.uuid().nullable(),
  customerId: z.uuid().nullable(),
  dealId: z.uuid().nullable(),
  id: z.uuid(),
  internalEntityOrganizationId: z.uuid().nullable(),
  kind: TreasuryOperationKindSchema,
  quoteId: z.uuid().nullable(),
  routeLegId: z.uuid().nullable(),
  sourceRef: z.string(),
  state: TreasuryOperationStateSchema,
  updatedAt: z.date(),
});

export type TreasuryOperation = z.infer<typeof TreasuryOperationSchema>;

export const TreasuryOperationInstructionStatusSchema = z.enum([
  "planned",
  "prepared",
  "submitted",
  "settled",
  "blocked",
  "failed",
  "voided",
  "return_requested",
  "returned",
]);

export const TreasuryOperationMoneySummarySchema = z.object({
  amountMinor: z.string().nullable(),
  currency: z.string().nullable(),
  currencyId: z.uuid().nullable(),
  formatted: z.string(),
});

export const TreasuryOperationAccountSummarySchema = z.object({
  identity: z.string().nullable(),
  label: z.string(),
});

export const TreasuryOperationInternalEntitySchema = z.object({
  name: z.string().nullable(),
  organizationId: z.uuid().nullable(),
});

export const TreasuryOperationDealRefSchema = z
  .object({
    applicantName: z.string().nullable(),
    dealId: z.uuid(),
    status: z.string(),
    type: TreasuryOperationDealTypeSchema,
  })
  .nullable();

export const TreasuryOperationLegRefSchema = z
  .object({
    idx: z.number().int().positive(),
    kind: TreasuryOperationLegKindSchema,
    legId: z.uuid(),
  })
  .nullable();

export const TreasuryOperationQueueContextSchema = z
  .object({
    blockers: z.array(z.string()),
    queue: TreasuryOperationFinanceQueueSchema,
    queueReason: z.string(),
  })
  .nullable();

export const TreasuryOperationWorkspaceItemSchema = z.object({
  actions: TreasuryInstructionActionsSchema,
  amount: TreasuryOperationMoneySummarySchema,
  availableOutcomeTransitions:
    TreasuryInstructionAvailableOutcomeTransitionsSchema,
  counterAmount: TreasuryOperationMoneySummarySchema.nullable(),
  createdAt: z.iso.datetime(),
  dealRef: TreasuryOperationDealRefSchema,
  destinationAccount: TreasuryOperationAccountSummarySchema,
  id: z.uuid(),
  instructionStatus: TreasuryOperationInstructionStatusSchema,
  internalEntity: TreasuryOperationInternalEntitySchema,
  kind: TreasuryOperationKindSchema,
  legRef: TreasuryOperationLegRefSchema,
  latestInstruction: TreasuryInstructionSchema.nullable(),
  nextAction: z.string(),
  providerRoute: z.string(),
  sourceAccount: TreasuryOperationAccountSummarySchema,
  sourceRef: z.string(),
  state: TreasuryOperationStateSchema,
});

export const TreasuryOperationViewCountsSchema = z.object({
  all: z.number().int().nonnegative(),
  exceptions: z.number().int().nonnegative(),
  fx: z.number().int().nonnegative(),
  incoming: z.number().int().nonnegative(),
  intercompany: z.number().int().nonnegative(),
  intracompany: z.number().int().nonnegative(),
  outgoing: z.number().int().nonnegative(),
});

export const TreasuryOperationWorkspaceListResponseSchema = z.object({
  data: z.array(TreasuryOperationWorkspaceItemSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  viewCounts: TreasuryOperationViewCountsSchema,
});

export const TreasuryOperationWorkspaceDetailSchema =
  TreasuryOperationWorkspaceItemSchema.extend({
    dealWorkbenchHref: z.string().nullable(),
    queueContext: TreasuryOperationQueueContextSchema,
  });

const JsonRecordSchema = z.record(z.string(), z.unknown());

export type TreasuryOperationInstructionStatus = z.infer<
  typeof TreasuryOperationInstructionStatusSchema
>;
export type TreasuryOperationMoneySummary = z.infer<
  typeof TreasuryOperationMoneySummarySchema
>;
export type TreasuryOperationAccountSummary = z.infer<
  typeof TreasuryOperationAccountSummarySchema
>;
export type TreasuryOperationInternalEntity = z.infer<
  typeof TreasuryOperationInternalEntitySchema
>;
export type TreasuryOperationDealRef = z.infer<
  typeof TreasuryOperationDealRefSchema
>;
export type TreasuryOperationLegRef = z.infer<
  typeof TreasuryOperationLegRefSchema
>;
export type TreasuryOperationQueueContext = z.infer<
  typeof TreasuryOperationQueueContextSchema
>;
export type TreasuryOperationWorkspaceItem = z.infer<
  typeof TreasuryOperationWorkspaceItemSchema
>;
export type TreasuryOperationViewCounts = z.infer<
  typeof TreasuryOperationViewCountsSchema
>;
export type TreasuryOperationWorkspaceListResponse = z.infer<
  typeof TreasuryOperationWorkspaceListResponseSchema
>;
export type TreasuryOperationWorkspaceDetail = z.infer<
  typeof TreasuryOperationWorkspaceDetailSchema
>;

export const TreasuryExecutionFillSchema = z.object({
  actualRateDen: z.string().nullable(),
  actualRateNum: z.string().nullable(),
  boughtAmountMinor: z.string().nullable(),
  boughtCurrencyId: z.uuid().nullable(),
  calculationSnapshotId: z.uuid().nullable(),
  confirmedAt: z.date().nullable(),
  createdAt: z.date(),
  dealId: z.uuid().nullable(),
  executedAt: z.date(),
  externalRecordId: z.string().nullable(),
  fillSequence: z.number().int().positive().nullable(),
  id: z.uuid(),
  instructionId: z.uuid().nullable(),
  metadata: JsonRecordSchema.nullable(),
  notes: z.string().nullable(),
  operationId: z.uuid(),
  providerCounterpartyId: z.uuid().nullable(),
  providerRef: z.string().nullable(),
  routeLegId: z.uuid().nullable(),
  routeVersionId: z.uuid().nullable(),
  soldAmountMinor: z.string().nullable(),
  soldCurrencyId: z.uuid().nullable(),
  sourceKind: TreasuryOperationFactSourceKindSchema,
  sourceRef: z.string(),
  updatedAt: z.date(),
});

export const TreasuryExecutionFillListResponseSchema = z.object({
  data: z.array(TreasuryExecutionFillSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type TreasuryExecutionFill = z.infer<typeof TreasuryExecutionFillSchema>;
export type TreasuryExecutionFillListResponse = z.infer<
  typeof TreasuryExecutionFillListResponseSchema
>;

export const TreasuryExecutionFeeSchema = z.object({
  amountMinor: z.string().nullable(),
  calculationSnapshotId: z.uuid().nullable(),
  chargedAt: z.date(),
  componentCode: z.string().nullable(),
  confirmedAt: z.date().nullable(),
  createdAt: z.date(),
  currencyId: z.uuid().nullable(),
  dealId: z.uuid().nullable(),
  externalRecordId: z.string().nullable(),
  feeFamily: z.string(),
  fillId: z.uuid().nullable(),
  id: z.uuid(),
  instructionId: z.uuid().nullable(),
  metadata: JsonRecordSchema.nullable(),
  notes: z.string().nullable(),
  operationId: z.uuid(),
  providerCounterpartyId: z.uuid().nullable(),
  providerRef: z.string().nullable(),
  routeComponentId: z.uuid().nullable(),
  routeLegId: z.uuid().nullable(),
  routeVersionId: z.uuid().nullable(),
  sourceKind: TreasuryOperationFactSourceKindSchema,
  sourceRef: z.string(),
  updatedAt: z.date(),
});

export const TreasuryExecutionFeeListResponseSchema = z.object({
  data: z.array(TreasuryExecutionFeeSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type TreasuryExecutionFee = z.infer<typeof TreasuryExecutionFeeSchema>;
export type TreasuryExecutionFeeListResponse = z.infer<
  typeof TreasuryExecutionFeeListResponseSchema
>;

export const TreasuryCashMovementSchema = z.object({
  accountRef: z.string().nullable(),
  amountMinor: z.string().nullable(),
  bookedAt: z.date(),
  calculationSnapshotId: z.uuid().nullable(),
  confirmedAt: z.date().nullable(),
  createdAt: z.date(),
  currencyId: z.uuid().nullable(),
  dealId: z.uuid().nullable(),
  direction: TreasuryCashMovementDirectionSchema,
  externalRecordId: z.string().nullable(),
  id: z.uuid(),
  instructionId: z.uuid().nullable(),
  metadata: JsonRecordSchema.nullable(),
  notes: z.string().nullable(),
  operationId: z.uuid(),
  providerCounterpartyId: z.uuid().nullable(),
  providerRef: z.string().nullable(),
  requisiteId: z.uuid().nullable(),
  routeLegId: z.uuid().nullable(),
  routeVersionId: z.uuid().nullable(),
  sourceKind: TreasuryOperationFactSourceKindSchema,
  sourceRef: z.string(),
  statementRef: z.string().nullable(),
  updatedAt: z.date(),
  valueDate: z.date().nullable(),
});

export const TreasuryCashMovementListResponseSchema = z.object({
  data: z.array(TreasuryCashMovementSchema),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export type TreasuryCashMovement = z.infer<typeof TreasuryCashMovementSchema>;
export type TreasuryCashMovementListResponse = z.infer<
  typeof TreasuryCashMovementListResponseSchema
>;
