import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  DealApprovalStatusSchema,
  DealApprovalTypeSchema,
  DealLegKindSchema,
  DealParticipantRoleSchema,
  DealStatusSchema,
  DealTypeSchema,
} from "./zod";

const NonNegativeIntegerStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/);

export const DealLegSchema = z.object({
  id: z.uuid(),
  idx: z.number().int().positive(),
  kind: DealLegKindSchema,
  status: DealStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DealLeg = z.infer<typeof DealLegSchema>;

export const DealParticipantSchema = z.object({
  id: z.uuid(),
  role: DealParticipantRoleSchema,
  partyId: z.uuid(),
  customerId: z.uuid().nullable(),
  organizationId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DealParticipant = z.infer<typeof DealParticipantSchema>;

export const DealStatusHistoryEntrySchema = z.object({
  id: z.uuid(),
  status: DealStatusSchema,
  changedBy: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.date(),
});

export type DealStatusHistoryEntry = z.infer<
  typeof DealStatusHistoryEntrySchema
>;

export const DealApprovalSchema = z.object({
  id: z.uuid(),
  approvalType: DealApprovalTypeSchema,
  status: DealApprovalStatusSchema,
  requestedBy: z.string().nullable(),
  decidedBy: z.string().nullable(),
  comment: z.string().nullable(),
  requestedAt: z.date(),
  decidedAt: z.date().nullable(),
});

export type DealApproval = z.infer<typeof DealApprovalSchema>;

export const DealSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  agreementId: z.uuid(),
  calculationId: z.uuid().nullable(),
  type: DealTypeSchema,
  status: DealStatusSchema,
  agentId: z.string().nullable(),
  reason: z.string().nullable(),
  intakeComment: z.string().nullable(),
  comment: z.string().nullable(),
  requestedAmount: z.string().nullable(),
  requestedCurrencyId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Deal = z.infer<typeof DealSchema>;

export const DealDetailsSchema = DealSchema.extend({
  legs: z.array(DealLegSchema),
  participants: z.array(DealParticipantSchema),
  statusHistory: z.array(DealStatusHistoryEntrySchema),
  approvals: z.array(DealApprovalSchema),
});

export type DealDetails = z.infer<typeof DealDetailsSchema>;

export const DealCalculationHistoryItemSchema = z.object({
  calculationId: z.uuid(),
  calculationTimestamp: z.date(),
  createdAt: z.date(),
  calculationCurrencyId: z.uuid(),
  baseCurrencyId: z.uuid(),
  originalAmountMinor: NonNegativeIntegerStringSchema,
  feeAmountMinor: NonNegativeIntegerStringSchema,
  totalAmountMinor: NonNegativeIntegerStringSchema,
  totalInBaseMinor: NonNegativeIntegerStringSchema,
  totalWithExpensesInBaseMinor: NonNegativeIntegerStringSchema,
  rateNum: NonNegativeIntegerStringSchema,
  rateDen: NonNegativeIntegerStringSchema,
  fxQuoteId: z.uuid().nullable(),
  sourceQuoteId: z.uuid().nullable(),
});

export type DealCalculationHistoryItem = z.infer<
  typeof DealCalculationHistoryItemSchema
>;

export const DealTraceQuoteSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  dealId: z.uuid().nullable(),
  usedDocumentId: z.uuid().nullable(),
  createdAt: z.date(),
  expiresAt: z.date(),
});

export type DealTraceQuote = z.infer<typeof DealTraceQuoteSchema>;

export const DealTraceFormalDocumentSchema = z.object({
  id: z.uuid(),
  docType: z.string(),
  dealId: z.uuid().nullable(),
  occurredAt: z.date(),
  submissionStatus: z.string(),
  approvalStatus: z.string(),
  postingStatus: z.string(),
  lifecycleStatus: z.string(),
  ledgerOperationIds: z.array(z.uuid()),
});

export type DealTraceFormalDocument = z.infer<
  typeof DealTraceFormalDocumentSchema
>;

export const DealTraceGeneratedFileSchema = z.object({
  fileAssetId: z.uuid(),
  linkKind: z.string(),
});

export type DealTraceGeneratedFile = z.infer<typeof DealTraceGeneratedFileSchema>;

export const DealTraceSchema = z.object({
  dealId: z.uuid(),
  calculationId: z.uuid().nullable(),
  generatedFiles: z.array(DealTraceGeneratedFileSchema),
  formalDocuments: z.array(DealTraceFormalDocumentSchema),
  ledgerOperationIds: z.array(z.uuid()),
  quotes: z.array(DealTraceQuoteSchema),
  status: DealStatusSchema,
  type: DealTypeSchema,
});

export type DealTrace = z.infer<typeof DealTraceSchema>;

export const PaginatedDealsSchema = createPaginatedListSchema(DealSchema);

export type PaginatedDeals = PaginatedList<Deal>;
