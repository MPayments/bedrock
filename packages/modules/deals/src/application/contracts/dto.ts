import { z } from "zod";

import { isDecimalString } from "@bedrock/shared/core";
import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  DealAttachmentIngestionStatusSchema,
  DealApprovalStatusSchema,
  DealApprovalTypeSchema,
  DealLegKindSchema,
  DealLegOperationKindSchema,
  DealLegStateSchema,
  DealOperationalPositionKindSchema,
  DealOperationalPositionStateSchema,
  DealParticipantRoleSchema,
  DealSectionIdSchema,
  DealStatusSchema,
  DealTransitionBlockerCodeSchema,
  DealTimelineEventTypeSchema,
  DealTimelineVisibilitySchema,
  DealTypeSchema,
  LegacyDealParticipantRoleSchema,
} from "./zod";

const DecimalStringSchema = z
  .string()
  .trim()
  .refine(isDecimalString);

const nullableDecimalStringSchema = DecimalStringSchema.nullable();

export const DealCounterpartySnapshotSchema = z.object({
  country: z.string().nullable(),
  displayName: z.string().nullable(),
  inn: z.string().nullable(),
  legalName: z.string().nullable(),
});

export type DealCounterpartySnapshot = z.infer<
  typeof DealCounterpartySnapshotSchema
>;

export const DealBankInstructionSnapshotSchema = z.object({
  accountNo: z.string().nullable(),
  bankAddress: z.string().nullable(),
  bankCountry: z.string().nullable(),
  bankName: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  bic: z.string().nullable(),
  iban: z.string().nullable(),
  label: z.string().nullable(),
  swift: z.string().nullable(),
});

export type DealBankInstructionSnapshot = z.infer<
  typeof DealBankInstructionSnapshotSchema
>;

export const DealCommonIntakeSectionSchema = z.object({
  applicantCounterpartyId: z.uuid().nullable(),
  customerNote: z.string().nullable(),
  requestedExecutionDate: z.coerce.date().nullable(),
});

export type DealCommonIntakeSection = z.infer<
  typeof DealCommonIntakeSectionSchema
>;

export const DealMoneyRequestIntakeSectionSchema = z.object({
  purpose: z.string().nullable(),
  sourceAmount: nullableDecimalStringSchema,
  sourceCurrencyId: z.uuid().nullable(),
  targetCurrencyId: z.uuid().nullable(),
});

export type DealMoneyRequestIntakeSection = z.infer<
  typeof DealMoneyRequestIntakeSectionSchema
>;

export const DealIncomingReceiptIntakeSectionSchema = z.object({
  contractNumber: z.string().nullable(),
  expectedAmount: nullableDecimalStringSchema,
  expectedAt: z.coerce.date().nullable(),
  invoiceNumber: z.string().nullable(),
  payerCounterpartyId: z.uuid().nullable(),
  payerSnapshot: DealCounterpartySnapshotSchema.nullable(),
});

export type DealIncomingReceiptIntakeSection = z.infer<
  typeof DealIncomingReceiptIntakeSectionSchema
>;

export const DealExternalBeneficiaryIntakeSectionSchema = z.object({
  beneficiaryCounterpartyId: z.uuid().nullable(),
  beneficiarySnapshot: DealCounterpartySnapshotSchema.nullable(),
  bankInstructionSnapshot: DealBankInstructionSnapshotSchema.nullable(),
});

export type DealExternalBeneficiaryIntakeSection = z.infer<
  typeof DealExternalBeneficiaryIntakeSectionSchema
>;

export const DealSettlementDestinationModeSchema = z.enum([
  "applicant_requisite",
  "manual",
]);
export type DealSettlementDestinationMode = z.infer<
  typeof DealSettlementDestinationModeSchema
>;

export const DealSettlementDestinationIntakeSectionSchema = z.object({
  bankInstructionSnapshot: DealBankInstructionSnapshotSchema.nullable(),
  mode: DealSettlementDestinationModeSchema.nullable(),
  requisiteId: z.uuid().nullable(),
});

export type DealSettlementDestinationIntakeSection = z.infer<
  typeof DealSettlementDestinationIntakeSectionSchema
>;

const DealIntakeBaseSchema = z.object({
  common: DealCommonIntakeSectionSchema,
  externalBeneficiary: DealExternalBeneficiaryIntakeSectionSchema,
  incomingReceipt: DealIncomingReceiptIntakeSectionSchema,
  moneyRequest: DealMoneyRequestIntakeSectionSchema,
  settlementDestination: DealSettlementDestinationIntakeSectionSchema,
});

export const PaymentDealIntakeDraftSchema = DealIntakeBaseSchema.extend({
  type: z.literal("payment"),
});

export const CurrencyExchangeDealIntakeDraftSchema = DealIntakeBaseSchema.extend({
  type: z.literal("currency_exchange"),
});

export const CurrencyTransitDealIntakeDraftSchema = DealIntakeBaseSchema.extend({
  type: z.literal("currency_transit"),
});

export const ExporterSettlementDealIntakeDraftSchema =
  DealIntakeBaseSchema.extend({
    type: z.literal("exporter_settlement"),
  });

export const DealIntakeDraftSchema = z.discriminatedUnion("type", [
  PaymentDealIntakeDraftSchema,
  CurrencyExchangeDealIntakeDraftSchema,
  CurrencyTransitDealIntakeDraftSchema,
  ExporterSettlementDealIntakeDraftSchema,
]);

export type DealIntakeDraft = z.infer<typeof DealIntakeDraftSchema>;

export const DealLegOperationRefSchema = z.object({
  kind: DealLegOperationKindSchema,
  operationId: z.uuid(),
  sourceRef: z.string(),
});

export type DealLegOperationRef = z.infer<typeof DealLegOperationRefSchema>;

export const DealWorkflowLegSchema = z.object({
  amountMinor: z.string().nullable().default(null),
  currencyCode: z.string().nullable().default(null),
  fromPartyName: z.string().nullable().default(null),
  fromRole: DealParticipantRoleSchema.nullable().default(null),
  id: z.uuid().nullable().default(null),
  idx: z.number().int().positive(),
  kind: DealLegKindSchema,
  operationRefs: z.array(DealLegOperationRefSchema).default([]),
  state: DealLegStateSchema,
  toPartyName: z.string().nullable().default(null),
  toRole: DealParticipantRoleSchema.nullable().default(null),
});

export type DealWorkflowLeg = z.infer<typeof DealWorkflowLegSchema>;

export const DealWorkflowParticipantSchema = z.object({
  counterpartyId: z.uuid().nullable(),
  customerId: z.uuid().nullable(),
  displayName: z.string().nullable(),
  id: z.uuid(),
  organizationId: z.uuid().nullable(),
  role: DealParticipantRoleSchema,
});

export type DealWorkflowParticipant = z.infer<
  typeof DealWorkflowParticipantSchema
>;

export const DealSectionCompletenessSchema = z.object({
  blockingReasons: z.array(z.string()),
  complete: z.boolean(),
  sectionId: DealSectionIdSchema,
});

export type DealSectionCompleteness = z.infer<
  typeof DealSectionCompletenessSchema
>;

export const DealTimelineActorSchema = z.object({
  label: z.string().nullable(),
  userId: z.string().nullable(),
});

export type DealTimelineActor = z.infer<typeof DealTimelineActorSchema>;

export const DealTimelineEventSchema = z.object({
  actor: DealTimelineActorSchema.nullable(),
  id: z.uuid(),
  occurredAt: z.date(),
  payload: z.record(z.string(), z.unknown()),
  type: DealTimelineEventTypeSchema,
  visibility: DealTimelineVisibilitySchema,
});

export type DealTimelineEvent = z.infer<typeof DealTimelineEventSchema>;

export const DealTransitionBlockerSchema = z.object({
  code: DealTransitionBlockerCodeSchema,
  message: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type DealTransitionBlocker = z.infer<typeof DealTransitionBlockerSchema>;

export const DealTransitionReadinessSchema = z.object({
  allowed: z.boolean(),
  blockers: z.array(DealTransitionBlockerSchema),
  targetStatus: DealStatusSchema,
});

export type DealTransitionReadiness = z.infer<
  typeof DealTransitionReadinessSchema
>;

export const DealRelatedQuoteSchema = z.object({
  expiresAt: z.date().nullable(),
  id: z.uuid(),
  status: z.string(),
});

export type DealRelatedQuote = z.infer<typeof DealRelatedQuoteSchema>;

export const DealRelatedCalculationSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  sourceQuoteId: z.uuid().nullable(),
});

export type DealRelatedCalculation = z.infer<
  typeof DealRelatedCalculationSchema
>;

export const DealRelatedAttachmentSchema = z.object({
  createdAt: z.date(),
  fileName: z.string(),
  id: z.uuid(),
});

export type DealRelatedAttachment = z.infer<typeof DealRelatedAttachmentSchema>;

export const DealAttachmentIngestionNormalizedPayloadSchema = z.object({
  amount: z.string().nullable(),
  beneficiarySnapshot: DealCounterpartySnapshotSchema.nullable(),
  bankInstructionSnapshot: DealBankInstructionSnapshotSchema.nullable(),
  contractNumber: z.string().nullable(),
  currencyCode: z.string().nullable(),
  currencyId: z.uuid().nullable(),
  documentPurpose: z.enum(["invoice", "contract", "other"]).nullable(),
  invoiceNumber: z.string().nullable(),
  paymentPurpose: z.string().nullable(),
});

export type DealAttachmentIngestionNormalizedPayload = z.infer<
  typeof DealAttachmentIngestionNormalizedPayloadSchema
>;

export const DealAttachmentIngestionSchema = z.object({
  appliedFields: z.array(z.string()),
  appliedRevision: z.number().int().positive().nullable(),
  attempts: z.number().int().nonnegative(),
  availableAt: z.date(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  fileAssetId: z.uuid(),
  lastProcessedAt: z.date().nullable(),
  normalizedPayload: DealAttachmentIngestionNormalizedPayloadSchema.nullable(),
  observedRevision: z.number().int().positive(),
  skippedFields: z.array(z.string()),
  status: DealAttachmentIngestionStatusSchema,
  updatedAt: z.date(),
});

export type DealAttachmentIngestion = z.infer<
  typeof DealAttachmentIngestionSchema
>;

export const DealRelatedFormalDocumentSchema = z.object({
  approvalStatus: z.string().nullable(),
  createdAt: z.date().nullable(),
  docType: z.string(),
  id: z.uuid(),
  lifecycleStatus: z.string().nullable(),
  occurredAt: z.date().nullable(),
  postingStatus: z.string().nullable(),
  submissionStatus: z.string().nullable(),
});

export type DealRelatedFormalDocument = z.infer<
  typeof DealRelatedFormalDocumentSchema
>;

export const DealRelatedResourcesSchema = z.object({
  attachments: z.array(DealRelatedAttachmentSchema),
  calculations: z.array(DealRelatedCalculationSchema),
  formalDocuments: z.array(DealRelatedFormalDocumentSchema),
  quotes: z.array(DealRelatedQuoteSchema),
});

export type DealRelatedResources = z.infer<typeof DealRelatedResourcesSchema>;

export const DealFundingResolutionStateSchema = z.enum([
  "not_applicable",
  "blocked",
  "resolved",
]);

export type DealFundingResolutionState = z.infer<
  typeof DealFundingResolutionStateSchema
>;

export const DealFundingStrategySchema = z.enum([
  "existing_inventory",
  "external_fx",
]);

export type DealFundingStrategy = z.infer<typeof DealFundingStrategySchema>;

export const DealFundingResolutionSchema = z.object({
  availableMinor: z.string().nullable(),
  fundingOrganizationId: z.uuid().nullable(),
  fundingRequisiteId: z.uuid().nullable(),
  reasonCode: z.string().nullable(),
  requiredAmountMinor: z.string().nullable(),
  state: DealFundingResolutionStateSchema,
  strategy: DealFundingStrategySchema.nullable(),
  targetCurrency: z.string().nullable(),
  targetCurrencyId: z.uuid().nullable(),
});

export type DealFundingResolution = z.infer<
  typeof DealFundingResolutionSchema
>;

export const DealSummarySchema = z.object({
  agreementId: z.uuid(),
  agentId: z.string().nullable(),
  calculationId: z.uuid().nullable(),
  createdAt: z.date(),
  id: z.uuid(),
  status: DealStatusSchema,
  type: DealTypeSchema,
  updatedAt: z.date(),
});

export type DealSummary = z.infer<typeof DealSummarySchema>;

export const DealQuoteAcceptanceSchema = z.object({
  acceptedAt: z.date(),
  acceptedByUserId: z.string(),
  agreementVersionId: z.uuid().nullable(),
  dealId: z.uuid(),
  dealRevision: z.number().int().positive(),
  expiresAt: z.date().nullable(),
  id: z.uuid(),
  quoteId: z.uuid(),
  quoteStatus: z.string(),
  replacedByQuoteId: z.uuid().nullable(),
  revokedAt: z.date().nullable(),
  usedAt: z.date().nullable(),
  usedDocumentId: z.uuid().nullable(),
});

export type DealQuoteAcceptance = z.infer<typeof DealQuoteAcceptanceSchema>;

export const DealOperationalPositionSchema = z.object({
  amountMinor: z.string().nullable(),
  currencyId: z.uuid().nullable(),
  kind: DealOperationalPositionKindSchema,
  reasonCode: z.string().nullable(),
  sourceRefs: z.array(z.string()),
  state: DealOperationalPositionStateSchema,
  updatedAt: z.date().nullable(),
});

export type DealOperationalPosition = z.infer<
  typeof DealOperationalPositionSchema
>;

export const DealOperationalStateSchema = z.object({
  positions: z.array(DealOperationalPositionSchema),
});

export type DealOperationalState = z.infer<typeof DealOperationalStateSchema>;

export const DealWorkflowProjectionSchema = z.object({
  acceptedQuote: DealQuoteAcceptanceSchema.nullable(),
  attachmentIngestions: z.array(DealAttachmentIngestionSchema),
  executionPlan: z.array(DealWorkflowLegSchema),
  fundingResolution: DealFundingResolutionSchema,
  intake: DealIntakeDraftSchema,
  nextAction: z.string(),
  operationalState: DealOperationalStateSchema,
  participants: z.array(DealWorkflowParticipantSchema),
  relatedResources: DealRelatedResourcesSchema,
  revision: z.number().int().positive(),
  sectionCompleteness: z.array(DealSectionCompletenessSchema),
  summary: DealSummarySchema,
  timeline: z.array(DealTimelineEventSchema),
  transitionReadiness: z.array(DealTransitionReadinessSchema),
});

export type DealWorkflowProjection = z.infer<
  typeof DealWorkflowProjectionSchema
>;

export const PortalDealIntakeSummarySchema = z.object({
  contractNumber: z.string().nullable(),
  customerNote: z.string().nullable(),
  expectedAmount: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  purpose: z.string().nullable(),
  requestedExecutionDate: z.date().nullable(),
  sourceAmount: z.string().nullable(),
  sourceCurrencyCode: z.string().nullable(),
  sourceCurrencyId: z.uuid().nullable(),
  targetCurrencyCode: z.string().nullable(),
  targetCurrencyId: z.uuid().nullable(),
});

export type PortalDealIntakeSummary = z.infer<
  typeof PortalDealIntakeSummarySchema
>;

export const PortalDealCalculationSummarySchema = z.object({
  id: z.uuid(),
}).nullable();

export type PortalDealCalculationSummary = z.infer<
  typeof PortalDealCalculationSummarySchema
>;

export const PortalDealProjectionSchema = z.object({
  calculationSummary: PortalDealCalculationSummarySchema,
  customerSafeIntake: PortalDealIntakeSummarySchema,
  nextAction: z.string(),
  summary: z.object({
    applicantDisplayName: z.string().nullable(),
    createdAt: z.date(),
    id: z.uuid(),
    status: DealStatusSchema,
    type: DealTypeSchema,
  }),
  timeline: z.array(DealTimelineEventSchema),
});

export type PortalDealProjection = z.infer<typeof PortalDealProjectionSchema>;

export const PortalDealListItemProjectionSchema = z.object({
  applicantDisplayName: z.string().nullable(),
  calculationSummary: PortalDealCalculationSummarySchema,
  createdAt: z.date(),
  id: z.uuid(),
  nextAction: z.string(),
  status: DealStatusSchema,
  type: DealTypeSchema,
});

export type PortalDealListItemProjection = z.infer<
  typeof PortalDealListItemProjectionSchema
>;

export const PortalDealListProjectionSchema = createPaginatedListSchema(
  PortalDealListItemProjectionSchema,
);

export type PortalDealListProjection = z.infer<
  typeof PortalDealListProjectionSchema
>;

export const DealLegSchema = z.object({
  createdAt: z.date(),
  id: z.uuid(),
  idx: z.number().int().positive(),
  kind: DealLegKindSchema,
  status: DealStatusSchema,
  updatedAt: z.date(),
});

export type DealLeg = z.infer<typeof DealLegSchema>;

export const DealParticipantSchema = z.object({
  counterpartyId: z.uuid().nullable(),
  createdAt: z.date(),
  customerId: z.uuid().nullable(),
  id: z.uuid(),
  organizationId: z.uuid().nullable(),
  partyId: z.uuid(),
  role: LegacyDealParticipantRoleSchema,
  updatedAt: z.date(),
});

export type DealParticipant = z.infer<typeof DealParticipantSchema>;

export const DealStatusHistoryEntrySchema = z.object({
  changedBy: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.date(),
  id: z.uuid(),
  status: DealStatusSchema,
});

export type DealStatusHistoryEntry = z.infer<
  typeof DealStatusHistoryEntrySchema
>;

export const DealApprovalSchema = z.object({
  approvalType: DealApprovalTypeSchema,
  comment: z.string().nullable(),
  decidedAt: z.date().nullable(),
  decidedBy: z.string().nullable(),
  id: z.uuid(),
  requestedAt: z.date(),
  requestedBy: z.string().nullable(),
  status: DealApprovalStatusSchema,
});

export type DealApproval = z.infer<typeof DealApprovalSchema>;

export const DealSchema = z.object({
  agreementId: z.uuid(),
  amount: z.string().nullable(),
  agentId: z.string().nullable(),
  calculationId: z.uuid().nullable(),
  comment: z.string().nullable(),
  currencyId: z.uuid().nullable(),
  createdAt: z.date(),
  customerId: z.uuid(),
  id: z.uuid(),
  intakeComment: z.string().nullable(),
  nextAction: z.string().nullable(),
  reason: z.string().nullable(),
  revision: z.number().int().positive(),
  status: DealStatusSchema,
  type: DealTypeSchema,
  updatedAt: z.date(),
});

export type Deal = z.infer<typeof DealSchema>;

export const DealDetailsSchema = DealSchema.extend({
  approvals: z.array(DealApprovalSchema),
  legs: z.array(DealLegSchema),
  participants: z.array(DealParticipantSchema),
  statusHistory: z.array(DealStatusHistoryEntrySchema),
});

export type DealDetails = z.infer<typeof DealDetailsSchema>;

export const DealCalculationHistoryItemSchema = z.object({
  baseCurrencyId: z.uuid(),
  calculationCurrencyId: z.uuid(),
  calculationId: z.uuid(),
  calculationTimestamp: z.date(),
  createdAt: z.date(),
  totalFeeAmountMinor: z.string(),
  fxQuoteId: z.uuid().nullable(),
  originalAmountMinor: z.string(),
  rateDen: z.string(),
  rateNum: z.string(),
  sourceQuoteId: z.uuid().nullable(),
  totalAmountMinor: z.string(),
  totalInBaseMinor: z.string(),
  totalWithExpensesInBaseMinor: z.string(),
});

export type DealCalculationHistoryItem = z.infer<
  typeof DealCalculationHistoryItemSchema
>;

export const DealTraceQuoteSchema = z.object({
  createdAt: z.date(),
  dealId: z.uuid().nullable(),
  expiresAt: z.date(),
  id: z.uuid(),
  status: z.string(),
  usedDocumentId: z.uuid().nullable(),
});

export type DealTraceQuote = z.infer<typeof DealTraceQuoteSchema>;

export const DealTraceFormalDocumentSchema = z.object({
  approvalStatus: z.string(),
  dealId: z.uuid().nullable(),
  docType: z.string(),
  id: z.uuid(),
  ledgerOperationIds: z.array(z.uuid()),
  lifecycleStatus: z.string(),
  occurredAt: z.date(),
  postingStatus: z.string(),
  submissionStatus: z.string(),
});

export type DealTraceFormalDocument = z.infer<
  typeof DealTraceFormalDocumentSchema
>;

export const DealTraceGeneratedFileSchema = z.object({
  fileAssetId: z.uuid(),
  linkKind: z.string(),
});

export type DealTraceGeneratedFile = z.infer<typeof DealTraceGeneratedFileSchema>;

export const DealTraceProjectionSchema = z.object({
  calculationId: z.uuid().nullable(),
  dealId: z.uuid(),
  formalDocuments: z.array(DealTraceFormalDocumentSchema),
  generatedFiles: z.array(DealTraceGeneratedFileSchema),
  ledgerOperationIds: z.array(z.uuid()),
  quotes: z.array(DealTraceQuoteSchema),
  timeline: z.array(DealTimelineEventSchema),
});

export type DealTraceProjection = z.infer<typeof DealTraceProjectionSchema>;

export const DealTraceSchema = DealTraceProjectionSchema.extend({
  status: DealStatusSchema,
  type: DealTypeSchema,
});

export type DealTrace = z.infer<typeof DealTraceSchema>;

export const PaginatedDealsSchema = createPaginatedListSchema(DealSchema);

export type PaginatedDeals = PaginatedList<Deal>;
