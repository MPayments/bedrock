import { z } from "zod";

import { AgreementDetailsSchema } from "@bedrock/agreements/contracts";
import { CalculationDetailsSchema } from "@bedrock/calculations/contracts";
import {
  DealApprovalSchema,
  DealCalculationHistoryItemSchema,
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
import {
  createPaginatedListSchema,
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

export const PortalDealProjectionSchema = z.object({
  attachments: z.array(
    z.object({
      createdAt: z.date(),
      fileName: z.string(),
      id: z.uuid(),
    }),
  ),
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
  quotes: z.array(DealRelatedQuoteSchema),
});

export type DealPricingSummary = z.infer<typeof DealPricingSummarySchema>;

export const CrmDealWorkbenchProjectionSchema = z.object({
  acceptedQuote: DealWorkflowProjectionSchema.shape.acceptedQuote,
  approvals: z.array(DealApprovalSchema),
  context: z.object({
    agreement: AgreementDetailsSchema.nullable(),
    applicant: CounterpartySchema.nullable(),
    customer: CustomerWorkspaceSummarySchema.nullable(),
    internalEntity: OrganizationSchema.nullable(),
    internalEntityRequisite: RequisiteSchema.nullable(),
    internalEntityRequisiteProvider: RequisiteProviderSchema.nullable(),
  }),
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

export const FinanceDealWorkspaceProjectionSchema = z.object({
  acceptedQuote: DealWorkflowProjectionSchema.shape.acceptedQuote,
  executionPlan: z.array(DealWorkflowLegSchema),
  operationalState: DealOperationalStateSchema,
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
