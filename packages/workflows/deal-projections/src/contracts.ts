import { z } from "zod";

import { AgreementDetailsSchema } from "@bedrock/agreements/contracts";
import { CalculationDetailsSchema } from "@bedrock/calculations/contracts";
import {
  DealApprovalSchema,
  DealBankInstructionSnapshotSchema,
  DealCalculationHistoryItemSchema,
  DealCounterpartySnapshotSchema,
  DealRelatedFormalDocumentSchema,
  DealRelatedQuoteSchema,
  DealSummarySchema,
  DealTimelineEventSchema,
  DealTransitionReadinessSchema,
  DealWorkflowLegSchema,
  DealWorkflowParticipantSchema,
  DealWorkflowProjectionSchema,
  DealSectionCompletenessSchema,
  DealOperationalStateSchema,
  PortalDealCalculationSummarySchema,
  PortalDealIntakeSummarySchema,
} from "@bedrock/deals/contracts";
import { FileAttachmentSchema } from "@bedrock/files/contracts";
import {
  CounterpartySchema,
  CustomerSchema,
  OrganizationSchema,
  RequisiteProviderSchema,
  RequisiteSchema,
} from "@bedrock/parties/contracts";
import { QuoteListItemSchema, QuoteSchema } from "@bedrock/treasury/contracts";
import {
  createPaginatedListSchema,
  MAX_QUERY_LIST_LIMIT,
} from "@bedrock/shared/core/pagination";

export const PortalSubmissionCompletenessSchema = z.object({
  blockingReasons: z.array(z.string()),
  complete: z.boolean(),
});

export type PortalSubmissionCompleteness = z.infer<
  typeof PortalSubmissionCompletenessSchema
>;

export const PortalDealQuoteSummarySchema = z
  .object({
    expiresAt: z.date().nullable(),
    quoteId: z.uuid().nullable(),
    status: z.string().nullable(),
  })
  .nullable();

export type PortalDealQuoteSummary = z.infer<
  typeof PortalDealQuoteSummarySchema
>;

export const PortalAttachmentIngestionStatusSchema = z
  .enum(["processing", "applied", "failed", "unavailable"])
  .nullable();

export type PortalAttachmentIngestionStatus = z.infer<
  typeof PortalAttachmentIngestionStatusSchema
>;

export const PortalDealAttachmentSchema = z.object({
  createdAt: z.date(),
  fileName: z.string(),
  id: z.uuid(),
  ingestionStatus: PortalAttachmentIngestionStatusSchema,
  purpose: FileAttachmentSchema.shape.purpose,
});

export type PortalDealAttachment = z.infer<typeof PortalDealAttachmentSchema>;

export const PortalDealProjectionSchema = z.object({
  attachments: z.array(PortalDealAttachmentSchema),
  calculationSummary: PortalDealCalculationSummarySchema,
  customerSafeIntake: PortalDealIntakeSummarySchema,
  nextAction: z.string(),
  quoteSummary: PortalDealQuoteSummarySchema,
  requiredActions: z.array(z.string()),
  submissionCompleteness: PortalSubmissionCompletenessSchema,
  summary: z.object({
    applicantDisplayName: z.string().nullable(),
    createdAt: z.date(),
    id: z.uuid(),
    status: DealSummarySchema.shape.status,
    type: DealSummarySchema.shape.type,
  }),
  timeline: z.array(DealTimelineEventSchema),
});

export type PortalDealProjection = z.infer<typeof PortalDealProjectionSchema>;

export const PortalDealListItemProjectionSchema = z.object({
  applicantDisplayName: z.string().nullable(),
  attachmentCount: z.number().int().nonnegative(),
  calculationSummary: PortalDealCalculationSummarySchema,
  createdAt: z.date(),
  id: z.uuid(),
  nextAction: z.string(),
  quoteExpiresAt: z.date().nullable(),
  status: DealSummarySchema.shape.status,
  submissionComplete: z.boolean(),
  type: DealSummarySchema.shape.type,
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

export const CustomerLegalEntitySummarySchema = z.object({
  counterpartyId: z.uuid(),
  email: z.string().nullable(),
  fullName: z.string(),
  inn: z.string().nullable(),
  orgName: z.string(),
  phone: z.string().nullable(),
  position: z.string().nullable(),
  relationshipKind: z.enum(["customer_owned", "external"]),
  shortName: z.string(),
});

export type CustomerLegalEntitySummary = z.infer<
  typeof CustomerLegalEntitySummarySchema
>;

export const CustomerWorkspaceSummarySchema = z.object({
  description: z.string().nullable(),
  displayName: z.string(),
  externalRef: z.string().nullable(),
  id: z.uuid(),
  legalEntities: z.array(CustomerLegalEntitySummarySchema),
});

export type CustomerWorkspaceSummary = z.infer<
  typeof CustomerWorkspaceSummarySchema
>;

export const DealPricingSummarySchema = z.object({
  calculationHistory: z.array(DealCalculationHistoryItemSchema),
  currentCalculation: CalculationDetailsSchema.nullable(),
  quoteEligibility: z.boolean(),
  quotes: z.array(QuoteSchema),
});

export type DealPricingSummary = z.infer<typeof DealPricingSummarySchema>;

export const CrmDealWorkbenchActionsSchema = z.object({
  canAcceptQuote: z.boolean(),
  canChangeAgreement: z.boolean(),
  canCreateCalculation: z.boolean(),
  canCreateFormalDocument: z.boolean(),
  canCreateQuote: z.boolean(),
  canEditIntake: z.boolean(),
  canReassignAssignee: z.boolean(),
  canUploadAttachment: z.boolean(),
});

export type CrmDealWorkbenchActions = z.infer<
  typeof CrmDealWorkbenchActionsSchema
>;

export const CrmDealWorkbenchEditabilitySchema = z.object({
  agreement: z.boolean(),
  assignee: z.boolean(),
  intake: z.boolean(),
});

export type CrmDealWorkbenchEditability = z.infer<
  typeof CrmDealWorkbenchEditabilitySchema
>;

export const CrmDealAssigneeSchema = z.object({
  userId: z.string().nullable(),
});

export type CrmDealAssignee = z.infer<typeof CrmDealAssigneeSchema>;

export const CrmDealEvidenceRequirementStateSchema = z.enum([
  "missing",
  "not_required",
  "provided",
]);

export type CrmDealEvidenceRequirementState = z.infer<
  typeof CrmDealEvidenceRequirementStateSchema
>;

export const CrmDealEvidenceRequirementSchema = z.object({
  blockingReasons: z.array(z.string()),
  code: z.string(),
  label: z.string(),
  state: CrmDealEvidenceRequirementStateSchema,
});

export type CrmDealEvidenceRequirement = z.infer<
  typeof CrmDealEvidenceRequirementSchema
>;

export const CrmDealBeneficiaryDraftSchema = z
  .object({
    bankInstructionSnapshot: DealBankInstructionSnapshotSchema.nullable(),
    beneficiarySnapshot: DealCounterpartySnapshotSchema.nullable(),
    fieldPresence: z.object({
      bankInstructionFields: z.number().int().nonnegative(),
      beneficiaryFields: z.number().int().nonnegative(),
    }),
    purpose: FileAttachmentSchema.shape.purpose,
    sourceAttachmentId: z.uuid(),
  })
  .nullable();

export type CrmDealBeneficiaryDraft = z.infer<
  typeof CrmDealBeneficiaryDraftSchema
>;

export const CrmDealDocumentRequirementStateSchema = z.enum([
  "in_progress",
  "missing",
  "not_required",
  "ready",
]);

export type CrmDealDocumentRequirementState = z.infer<
  typeof CrmDealDocumentRequirementStateSchema
>;

export const CrmDealDocumentRequirementSchema = z.object({
  activeDocumentId: z.uuid().nullable(),
  blockingReasons: z.array(z.string()),
  createAllowed: z.boolean(),
  docType: z.string(),
  openAllowed: z.boolean(),
  stage: z.enum(["opening", "closing"]),
  state: CrmDealDocumentRequirementStateSchema,
});

export type CrmDealDocumentRequirement = z.infer<
  typeof CrmDealDocumentRequirementSchema
>;

export const CrmDealWorkbenchProjectionSchema = z.object({
  acceptedQuote: DealWorkflowProjectionSchema.shape.acceptedQuote,
  actions: CrmDealWorkbenchActionsSchema,
  approvals: z.array(DealApprovalSchema),
  assignee: CrmDealAssigneeSchema,
  beneficiaryDraft: CrmDealBeneficiaryDraftSchema,
  context: z.object({
    agreement: AgreementDetailsSchema.nullable(),
    applicant: CounterpartySchema.nullable(),
    customer: CustomerWorkspaceSummarySchema.nullable(),
    internalEntity: OrganizationSchema.nullable(),
    internalEntityRequisite: RequisiteSchema.nullable(),
    internalEntityRequisiteProvider: RequisiteProviderSchema.nullable(),
  }),
  documentRequirements: z.array(CrmDealDocumentRequirementSchema),
  editability: CrmDealWorkbenchEditabilitySchema,
  evidenceRequirements: z.array(CrmDealEvidenceRequirementSchema),
  executionPlan: z.array(DealWorkflowLegSchema),
  intake: DealWorkflowProjectionSchema.shape.intake,
  nextAction: z.string(),
  operationalState: DealOperationalStateSchema,
  participants: z.array(DealWorkflowParticipantSchema),
  pricing: DealPricingSummarySchema,
  relatedResources: z.object({
    attachments: z.array(FileAttachmentSchema),
    formalDocuments: z.array(DealRelatedFormalDocumentSchema),
  }),
  sectionCompleteness: z.array(DealSectionCompletenessSchema),
  summary: DealSummarySchema.extend({
    applicantDisplayName: z.string().nullable(),
    customerDisplayName: z.string().nullable(),
    internalEntityDisplayName: z.string().nullable(),
  }),
  timeline: z.array(DealTimelineEventSchema),
  transitionReadiness: z.array(DealTransitionReadinessSchema),
  workflow: DealWorkflowProjectionSchema,
});

export type CrmDealWorkbenchProjection = z.infer<
  typeof CrmDealWorkbenchProjectionSchema
>;

export const CrmDealBoardStageSchema = z.enum([
  "active",
  "documents",
  "drafts",
  "execution_blocked",
  "pricing",
]);

export type CrmDealBoardStage = z.infer<typeof CrmDealBoardStageSchema>;

export const CrmDealBoardCountsSchema = z.object({
  active: z.number().int().nonnegative(),
  documents: z.number().int().nonnegative(),
  drafts: z.number().int().nonnegative(),
  execution_blocked: z.number().int().nonnegative(),
  pricing: z.number().int().nonnegative(),
});

export type CrmDealBoardCounts = z.infer<typeof CrmDealBoardCountsSchema>;

export const CrmDealBoardItemSchema = z.object({
  applicantName: z.string().nullable(),
  assigneeUserId: z.string().nullable(),
  blockingReasons: z.array(z.string()),
  customerName: z.string().nullable(),
  documentSummary: z.object({
    attachmentCount: z.number().int().nonnegative(),
    formalDocumentCount: z.number().int().nonnegative(),
  }),
  id: z.uuid(),
  nextAction: z.string(),
  quoteSummary: PortalDealQuoteSummarySchema,
  stage: CrmDealBoardStageSchema,
  status: DealSummarySchema.shape.status,
  type: DealSummarySchema.shape.type,
  updatedAt: z.date(),
});

export type CrmDealBoardItem = z.infer<typeof CrmDealBoardItemSchema>;

export const CrmDealBoardProjectionSchema = z.object({
  counts: CrmDealBoardCountsSchema,
  items: z.array(CrmDealBoardItemSchema),
});

export type CrmDealBoardProjection = z.infer<
  typeof CrmDealBoardProjectionSchema
>;

export const CRM_DEALS_SORT_COLUMNS = [
  "id",
  "createdAt",
  "client",
  "amount",
  "amountInBase",
  "closedAt",
  "agentName",
] as const;

export const CrmDealsListQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(MAX_QUERY_LIST_LIMIT).default(20),
  sortBy: z.enum(CRM_DEALS_SORT_COLUMNS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  statuses: z.string().optional(),
  currencies: z.string().optional(),
  customerId: z.string().uuid().optional(),
  agentId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  qClient: z.string().trim().min(1).optional(),
  qComment: z.string().trim().min(1).optional(),
});

export type CrmDealsListQuery = z.infer<typeof CrmDealsListQuerySchema>;

export const CrmDealListItemSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
  client: z.string(),
  clientId: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
  amountInBase: z.number(),
  baseCurrencyCode: z.string(),
  status: z.string(),
  agentName: z.string(),
  comment: z.string().optional(),
  feePercentage: z.number(),
});

export type CrmDealListItem = z.infer<typeof CrmDealListItemSchema>;

export const CrmDealsListProjectionSchema = z.object({
  data: z.array(CrmDealListItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type CrmDealsListProjection = z.infer<
  typeof CrmDealsListProjectionSchema
>;

export const CrmDealsStatsQuerySchema = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
});

export type CrmDealsStatsQuery = z.infer<typeof CrmDealsStatsQuerySchema>;

export const CrmDealsStatsSchema = z.object({
  totalCount: z.number().int(),
  byStatus: z.record(z.string(), z.number().int()),
  totalAmount: z.string(),
});

export type CrmDealsStats = z.infer<typeof CrmDealsStatsSchema>;

export const CrmDealByStatusItemSchema = z.object({
  id: z.string().uuid(),
  client: z.string(),
  amount: z.number(),
  currency: z.string(),
  amountInBase: z.number(),
  baseCurrencyCode: z.string(),
  status: z.string(),
  createdAt: z.string(),
  comment: z.string().optional(),
});

export type CrmDealByStatusItem = z.infer<typeof CrmDealByStatusItemSchema>;

export const CrmDealsByStatusSchema = z.object({
  pending: z.array(CrmDealByStatusItemSchema),
  inProgress: z.array(CrmDealByStatusItemSchema),
  done: z.array(CrmDealByStatusItemSchema),
});

export type CrmDealsByStatus = z.infer<typeof CrmDealsByStatusSchema>;

export const CrmDealsByDayQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  statuses: z.string().optional(),
  currencies: z.string().optional(),
  customerId: z.string().uuid().optional(),
  agentId: z.string().optional(),
  reportCurrencyCode: z.string().optional(),
});

export type CrmDealsByDayQuery = z.infer<typeof CrmDealsByDayQuerySchema>;

export const CrmDealsByDayItemSchema = z
  .object({
    date: z.string(),
    amount: z.number(),
    count: z.number(),
    closedCount: z.number(),
    closedAmount: z.number(),
  })
  .passthrough();

export type CrmDealsByDayItem = z.infer<typeof CrmDealsByDayItemSchema>;

export const FinanceDealQueueSchema = z.enum([
  "funding",
  "execution",
  "failed_instruction",
]);

export type FinanceDealQueue = z.infer<typeof FinanceDealQueueSchema>;

export const FinanceProfitabilitySnapshotSchema = z
  .object({
    calculationId: z.uuid(),
    currencyId: z.uuid(),
    feeRevenueMinor: z.string(),
    spreadRevenueMinor: z.string(),
    totalRevenueMinor: z.string(),
  })
  .nullable();

export type FinanceProfitabilitySnapshot = z.infer<
  typeof FinanceProfitabilitySnapshotSchema
>;

export const FinanceDealExecutionSummarySchema = z.object({
  blockedLegCount: z.number().int().nonnegative(),
  doneLegCount: z.number().int().nonnegative(),
  totalLegCount: z.number().int().nonnegative(),
});

export type FinanceDealExecutionSummary = z.infer<
  typeof FinanceDealExecutionSummarySchema
>;

export const FinanceDealDocumentSummarySchema = z.object({
  attachmentCount: z.number().int().nonnegative(),
  formalDocumentCount: z.number().int().nonnegative(),
});

export type FinanceDealDocumentSummary = z.infer<
  typeof FinanceDealDocumentSummarySchema
>;

export const FinanceDealQueueItemSchema = z.object({
  applicantName: z.string().nullable(),
  blockingReasons: z.array(z.string()),
  createdAt: DealSummarySchema.shape.createdAt,
  dealId: z.uuid(),
  documentSummary: FinanceDealDocumentSummarySchema,
  executionSummary: FinanceDealExecutionSummarySchema,
  internalEntityName: z.string().nullable(),
  nextAction: z.string(),
  operationalState: DealOperationalStateSchema,
  profitabilitySnapshot: FinanceProfitabilitySnapshotSchema,
  queue: FinanceDealQueueSchema,
  queueReason: z.string(),
  quoteSummary: PortalDealQuoteSummarySchema,
  status: DealSummarySchema.shape.status,
  type: DealSummarySchema.shape.type,
});

export type FinanceDealQueueItem = z.infer<typeof FinanceDealQueueItemSchema>;

export const FinanceDealQueueCountsSchema = z.object({
  execution: z.number().int().nonnegative(),
  failed_instruction: z.number().int().nonnegative(),
  funding: z.number().int().nonnegative(),
});

export type FinanceDealQueueCounts = z.infer<
  typeof FinanceDealQueueCountsSchema
>;

export const FinanceDealQueueFiltersSchema = z.object({
  applicant: z.string().trim().min(1).optional(),
  internalEntity: z.string().trim().min(1).optional(),
  queue: FinanceDealQueueSchema.optional(),
  status: DealSummarySchema.shape.status.optional(),
  type: DealSummarySchema.shape.type.optional(),
});

export type FinanceDealQueueFilters = z.infer<
  typeof FinanceDealQueueFiltersSchema
>;

export const FinanceDealQueueProjectionSchema = z.object({
  counts: FinanceDealQueueCountsSchema,
  filters: FinanceDealQueueFiltersSchema,
  items: z.array(FinanceDealQueueItemSchema),
});

export type FinanceDealQueueProjection = z.infer<
  typeof FinanceDealQueueProjectionSchema
>;

export const FinanceDealWorkspaceActionsSchema = z.object({
  canCreateCalculation: z.boolean(),
  canCreateQuote: z.boolean(),
  canUploadAttachment: z.boolean(),
});

export type FinanceDealWorkspaceActions = z.infer<
  typeof FinanceDealWorkspaceActionsSchema
>;

export const FinanceDealAttachmentRequirementStateSchema = z.enum([
  "missing",
  "not_required",
  "provided",
]);

export type FinanceDealAttachmentRequirementState = z.infer<
  typeof FinanceDealAttachmentRequirementStateSchema
>;

export const FinanceDealAttachmentRequirementSchema = z.object({
  blockingReasons: z.array(z.string()),
  code: z.string(),
  label: z.string(),
  state: FinanceDealAttachmentRequirementStateSchema,
});

export type FinanceDealAttachmentRequirement = z.infer<
  typeof FinanceDealAttachmentRequirementSchema
>;

export const FinanceDealFormalDocumentRequirementStateSchema = z.enum([
  "in_progress",
  "missing",
  "not_required",
  "ready",
]);

export type FinanceDealFormalDocumentRequirementState = z.infer<
  typeof FinanceDealFormalDocumentRequirementStateSchema
>;

export const FinanceDealFormalDocumentRequirementSchema = z.object({
  activeDocumentId: z.uuid().nullable(),
  blockingReasons: z.array(z.string()),
  createAllowed: z.boolean(),
  docType: z.string(),
  openAllowed: z.boolean(),
  stage: z.enum(["opening", "closing"]),
  state: FinanceDealFormalDocumentRequirementStateSchema,
});

export type FinanceDealFormalDocumentRequirement = z.infer<
  typeof FinanceDealFormalDocumentRequirementSchema
>;

export const FinanceDealPricingContextSchema = z.object({
  quoteEligibility: z.boolean(),
  requestedAmount: z.string().nullable(),
  requestedCurrencyId: z.uuid().nullable(),
  targetCurrencyId: z.uuid().nullable(),
});

export type FinanceDealPricingContext = z.infer<
  typeof FinanceDealPricingContextSchema
>;

export const FinanceDealWorkspaceProjectionSchema = z.object({
  acceptedQuote: DealWorkflowProjectionSchema.shape.acceptedQuote,
  acceptedQuoteDetails: QuoteListItemSchema.nullable(),
  actions: FinanceDealWorkspaceActionsSchema,
  attachmentRequirements: z.array(FinanceDealAttachmentRequirementSchema),
  executionPlan: z.array(DealWorkflowLegSchema),
  formalDocumentRequirements: z.array(
    FinanceDealFormalDocumentRequirementSchema,
  ),
  nextAction: z.string(),
  operationalState: DealOperationalStateSchema,
  pricing: FinanceDealPricingContextSchema,
  profitabilitySnapshot: FinanceProfitabilitySnapshotSchema,
  queueContext: z.object({
    blockers: z.array(z.string()),
    queue: FinanceDealQueueSchema,
    queueReason: z.string(),
  }),
  relatedResources: z.object({
    attachments: z.array(FileAttachmentSchema),
    formalDocuments: z.array(DealRelatedFormalDocumentSchema),
    quotes: z.array(DealRelatedQuoteSchema),
  }),
  summary: DealSummarySchema.extend({
    applicantDisplayName: z.string().nullable(),
    internalEntityDisplayName: z.string().nullable(),
  }),
  timeline: z.array(DealTimelineEventSchema),
  workflow: DealWorkflowProjectionSchema,
});

export type FinanceDealWorkspaceProjection = z.infer<
  typeof FinanceDealWorkspaceProjectionSchema
>;
