import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import {
  DealAttachmentIngestionNormalizedPayloadSchema,
  DealHeaderSchema,
  DealSettlementDestinationModeSchema,
} from "./dto";
import {
  DealAttachmentIngestionStatusSchema,
  DealApprovalScopeSchema,
  DealLegStateSchema,
  DealRouteComponentBasisTypeSchema,
  DealRouteComponentClassificationSchema,
  DealRouteComponentFormulaTypeSchema,
  DealRouteLegKindSchema,
  DealRoutePartyKindSchema,
  DealRouteTemplateParticipantBindingSchema,
  DealStatusSchema,
  DealTypeSchema,
} from "./zod";

const nullableText = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableShortText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableDecimalText = z
  .string()
  .trim()
  .refine((value) => {
    if (value.length === 0) {
      return false;
    }

    const parts = value.split(".");
    if (parts.length > 2) {
      return false;
    }

    return parts.every((part) => part.length > 0 && /^[0-9]+$/.test(part));
  }, "Must be a positive decimal string")
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableDateText = z
  .string()
  .trim()
  .date()
  .nullish()
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null));

const nullablePortalCurrencyReference = z
  .string()
  .trim()
  .nullish()
  .transform((value) => {
    const normalized = trimToNull(value) ?? null;

    if (!normalized) {
      return null;
    }

    return z.uuid().safeParse(normalized).success
      ? normalized
      : normalized.toUpperCase();
  })
  .refine(
    (value) =>
      value === null ||
      z.uuid().safeParse(value).success ||
      /^[A-Z0-9]{3,16}$/u.test(value),
      "Must be a currency UUID or ISO code",
  );

const RouteMetadataSchema = z.record(z.string(), z.unknown()).default({});
const nullableMinorIntegerString = z
  .string()
  .trim()
  .regex(/^-?[0-9]+$/u)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const nullableRouteDecimal = z
  .string()
  .trim()
  .refine((value) => /^[0-9]+(?:\.[0-9]+)?$/u.test(value), "Must be a decimal string")
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const routeCodeSchema = z.string().trim().min(1).max(64);
const routeTemplateNameSchema = z.string().trim().min(1).max(255);
const routeRoleSchema = z.string().trim().min(1).max(64);
const settlementModelSchema = z.string().trim().min(1).max(64);
const roundingModeSchema = z.string().trim().min(1).max(32);
const CustomerFacingDealTypeSchema = z.enum([
  "payment",
  "currency_exchange",
  "currency_transit",
  "exporter_settlement",
]);

export const CreatePortalDealInputSchema = z.object({
  common: z.object({
    applicantCounterpartyId: z.uuid(),
    customerNote: nullableText,
    requestedExecutionDate: z.coerce.date().nullable(),
  }),
  incomingReceipt: z
    .object({
      contractNumber: nullableShortText,
      expectedAmount: nullableDecimalText,
      expectedAt: z.coerce.date().nullable().optional().default(null),
      expectedCurrencyId: nullablePortalCurrencyReference.optional().default(null),
      invoiceNumber: nullableShortText,
    })
    .optional()
    .default(() => ({
      contractNumber: null,
      expectedAmount: null,
      expectedAt: null,
      expectedCurrencyId: null,
      invoiceNumber: null,
    })),
  moneyRequest: z.object({
    purpose: nullableText,
    sourceAmount: nullableDecimalText,
    sourceCurrencyId: nullablePortalCurrencyReference,
    targetCurrencyId: nullablePortalCurrencyReference.optional().default(null),
  }),
  type: CustomerFacingDealTypeSchema,
});

export type CreatePortalDealInput = z.infer<typeof CreatePortalDealInputSchema>;

export const CreateDealDraftInputSchema = z.object({
  agreementId: z.uuid().optional(),
  customerId: z.uuid(),
  header: DealHeaderSchema,
});

export type CreateDealDraftInput = z.infer<typeof CreateDealDraftInputSchema>;

export const UpdateDealHeaderInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  header: DealHeaderSchema,
});

export type UpdateDealHeaderInput = z.infer<typeof UpdateDealHeaderInputSchema>;

export const CreateDealRouteDraftInputSchema = z.object({}).strict();
export type CreateDealRouteDraftInput = z.infer<
  typeof CreateDealRouteDraftInputSchema
>;

export const DealRouteParticipantInputSchema = z.object({
  code: routeCodeSchema,
  displayNameSnapshot: nullableShortText,
  metadata: RouteMetadataSchema,
  partyId: z.uuid(),
  partyKind: DealRoutePartyKindSchema,
  requisiteId: z.uuid().nullable().optional().default(null),
  role: routeRoleSchema,
  sequence: z.number().int().positive(),
});

export type DealRouteParticipantInput = z.infer<
  typeof DealRouteParticipantInputSchema
>;

export const DealRouteLegInputSchema = z.object({
  code: routeCodeSchema,
  executionCounterpartyId: z.uuid().nullable().optional().default(null),
  expectedFromAmountMinor: nullableMinorIntegerString,
  expectedRateDen: nullableMinorIntegerString,
  expectedRateNum: nullableMinorIntegerString,
  expectedToAmountMinor: nullableMinorIntegerString,
  fromCurrencyId: z.uuid(),
  fromParticipantCode: routeCodeSchema,
  idx: z.number().int().positive(),
  kind: DealRouteLegKindSchema,
  notes: nullableText,
  settlementModel: settlementModelSchema,
  toCurrencyId: z.uuid(),
  toParticipantCode: routeCodeSchema,
});

export type DealRouteLegInput = z.infer<typeof DealRouteLegInputSchema>;

export const DealRouteCostComponentInputSchema = z.object({
  basisType: DealRouteComponentBasisTypeSchema,
  bps: nullableRouteDecimal,
  classification: DealRouteComponentClassificationSchema,
  code: routeCodeSchema,
  currencyId: z.uuid(),
  family: z.string().trim().min(1).max(64),
  fixedAmountMinor: nullableMinorIntegerString,
  formulaType: DealRouteComponentFormulaTypeSchema,
  includedInClientRate: z.boolean().optional().default(false),
  legCode: routeCodeSchema.nullish().transform((value) => trimToNull(value) ?? null),
  manualAmountMinor: nullableMinorIntegerString,
  notes: nullableText,
  perMillion: nullableRouteDecimal,
  roundingMode: roundingModeSchema.optional().default("half_up"),
  sequence: z.number().int().positive(),
});

export type DealRouteCostComponentInput = z.infer<
  typeof DealRouteCostComponentInputSchema
>;

export const ReplaceDealRouteVersionInputSchema = z.object({
  costComponents: z.array(DealRouteCostComponentInputSchema),
  legs: z.array(DealRouteLegInputSchema),
  participants: z.array(DealRouteParticipantInputSchema),
});

export type ReplaceDealRouteVersionInput = z.infer<
  typeof ReplaceDealRouteVersionInputSchema
>;

export const DealRouteTemplateParticipantInputSchema = z.object({
  bindingKind: DealRouteTemplateParticipantBindingSchema,
  code: routeCodeSchema,
  displayNameTemplate: nullableShortText,
  metadata: RouteMetadataSchema,
  partyId: z.uuid().nullable().optional().default(null),
  partyKind: DealRoutePartyKindSchema,
  requisiteId: z.uuid().nullable().optional().default(null),
  role: routeRoleSchema,
  sequence: z.number().int().positive(),
});

export type DealRouteTemplateParticipantInput = z.infer<
  typeof DealRouteTemplateParticipantInputSchema
>;

export const DealRouteTemplateLegInputSchema = z.object({
  code: routeCodeSchema,
  executionCounterpartyId: z.uuid().nullable().optional().default(null),
  expectedFromAmountMinor: nullableMinorIntegerString,
  expectedRateDen: nullableMinorIntegerString,
  expectedRateNum: nullableMinorIntegerString,
  expectedToAmountMinor: nullableMinorIntegerString,
  fromCurrencyId: z.uuid(),
  fromParticipantCode: routeCodeSchema,
  idx: z.number().int().positive(),
  kind: DealRouteLegKindSchema,
  notes: nullableText,
  settlementModel: settlementModelSchema,
  toCurrencyId: z.uuid(),
  toParticipantCode: routeCodeSchema,
});

export type DealRouteTemplateLegInput = z.infer<
  typeof DealRouteTemplateLegInputSchema
>;

export const DealRouteTemplateCostComponentInputSchema = z.object({
  basisType: DealRouteComponentBasisTypeSchema,
  bps: nullableRouteDecimal,
  classification: DealRouteComponentClassificationSchema,
  code: routeCodeSchema,
  currencyId: z.uuid(),
  family: z.string().trim().min(1).max(64),
  fixedAmountMinor: nullableMinorIntegerString,
  formulaType: DealRouteComponentFormulaTypeSchema,
  includedInClientRate: z.boolean().optional().default(false),
  legCode: routeCodeSchema.nullish().transform((value) => trimToNull(value) ?? null),
  manualAmountMinor: nullableMinorIntegerString,
  notes: nullableText,
  perMillion: nullableRouteDecimal,
  roundingMode: roundingModeSchema.optional().default("half_up"),
  sequence: z.number().int().positive(),
});

export type DealRouteTemplateCostComponentInput = z.infer<
  typeof DealRouteTemplateCostComponentInputSchema
>;

export const CreateDealRouteTemplateInputSchema = z.object({
  code: routeCodeSchema,
  costComponents: z.array(DealRouteTemplateCostComponentInputSchema),
  dealType: DealTypeSchema,
  description: nullableText,
  legs: z.array(DealRouteTemplateLegInputSchema),
  name: routeTemplateNameSchema,
  participants: z.array(DealRouteTemplateParticipantInputSchema),
});

export type CreateDealRouteTemplateInput = z.infer<
  typeof CreateDealRouteTemplateInputSchema
>;

export const UpdateDealRouteTemplateInputSchema = z.object({
  code: routeCodeSchema,
  costComponents: z.array(DealRouteTemplateCostComponentInputSchema),
  dealType: DealTypeSchema,
  description: nullableText,
  legs: z.array(DealRouteTemplateLegInputSchema),
  name: routeTemplateNameSchema,
  participants: z.array(DealRouteTemplateParticipantInputSchema),
});

export type UpdateDealRouteTemplateInput = z.infer<
  typeof UpdateDealRouteTemplateInputSchema
>;

export const ApplyDealRouteTemplateInputSchema = z.object({
  templateId: z.uuid(),
});

export type ApplyDealRouteTemplateInput = z.infer<
  typeof ApplyDealRouteTemplateInputSchema
>;

export const UpdateDealAgreementInputSchema = z.object({
  agreementId: z.uuid(),
});

export type UpdateDealAgreementInput = z.infer<
  typeof UpdateDealAgreementInputSchema
>;

export const AssignDealAgentInputSchema = z.object({
  agentId: nullableShortText,
});

export type AssignDealAgentInput = z.infer<typeof AssignDealAgentInputSchema>;

export const UpdateDealCommentInputSchema = z.object({
  comment: nullableText,
});

export type UpdateDealCommentInput = z.infer<typeof UpdateDealCommentInputSchema>;

export const LinkDealCalculationInputSchema = z.object({
  calculationId: z.uuid(),
  sourceQuoteId: z.uuid().nullable().optional(),
});

export type LinkDealCalculationInput = z.infer<
  typeof LinkDealCalculationInputSchema
>;

export const ApproveDealInputSchema = z.object({
  comment: nullableText.optional(),
  scope: DealApprovalScopeSchema,
});

export type ApproveDealInput = z.infer<typeof ApproveDealInputSchema>;

export const RejectDealInputSchema = z.object({
  reason: nullableText,
  scope: DealApprovalScopeSchema,
});

export type RejectDealInput = z.infer<typeof RejectDealInputSchema>;

export const AcceptDealCalculationInputSchema = z.object({
  calculationId: z.uuid(),
});

export type AcceptDealCalculationInput = z.infer<
  typeof AcceptDealCalculationInputSchema
>;

export const SupersedeDealCalculationInputSchema = z.object({
  calculationId: z.uuid(),
  reason: nullableText.optional(),
});

export type SupersedeDealCalculationInput = z.infer<
  typeof SupersedeDealCalculationInputSchema
>;

export const RequestDealExecutionInputSchema = z.object({
  comment: nullableText.optional(),
});

export type RequestDealExecutionInput = z.infer<
  typeof RequestDealExecutionInputSchema
>;

export const CreateDealLegOperationInputSchema = z.object({
  comment: nullableText.optional(),
});

export type CreateDealLegOperationInput = z.infer<
  typeof CreateDealLegOperationInputSchema
>;

export const ResolveDealExecutionBlockerInputSchema = z.object({
  comment: nullableText.optional(),
  legId: z.uuid(),
});

export type ResolveDealExecutionBlockerInput = z.infer<
  typeof ResolveDealExecutionBlockerInputSchema
>;

export const CloseDealInputSchema = z.object({
  comment: nullableText.optional(),
});

export type CloseDealInput = z.infer<typeof CloseDealInputSchema>;

export const AppendDealTimelineEventInputSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  sourceRef: nullableShortText,
  type: z.enum([
    "deal_closed",
    "quote_created",
    "quote_expired",
    "quote_used",
    "execution_requested",
    "leg_operation_created",
    "instruction_prepared",
    "instruction_submitted",
    "instruction_settled",
    "instruction_failed",
    "instruction_retried",
    "instruction_voided",
    "return_requested",
    "instruction_returned",
    "attachment_uploaded",
    "attachment_deleted",
    "attachment_ingested",
    "attachment_ingestion_failed",
    "document_created",
    "document_status_changed",
  ]),
  visibility: z.enum(["customer_safe", "internal"]).optional().default("internal"),
});

export type AppendDealTimelineEventInput = z.infer<
  typeof AppendDealTimelineEventInputSchema
>;

export const TransitionDealStatusInputSchema = z.object({
  comment: nullableText.optional(),
  status: DealStatusSchema,
});

export type TransitionDealStatusInput = z.infer<
  typeof TransitionDealStatusInputSchema
>;

export const UpdateDealLegStateInputSchema = z.object({
  comment: nullableText.optional(),
  state: DealLegStateSchema,
});

export type UpdateDealLegStateInput = z.infer<
  typeof UpdateDealLegStateInputSchema
>;

export const EnqueueDealAttachmentIngestionInputSchema = z.object({
  dealId: z.uuid(),
  fileAssetId: z.uuid(),
});

export type EnqueueDealAttachmentIngestionInput = z.infer<
  typeof EnqueueDealAttachmentIngestionInputSchema
>;

export const ClaimDealAttachmentIngestionsInputSchema = z.object({
  batchSize: z.number().int().positive().max(100).default(25),
  leaseSeconds: z.number().int().positive().max(3600).default(600),
});

export type ClaimDealAttachmentIngestionsInput = z.infer<
  typeof ClaimDealAttachmentIngestionsInputSchema
>;

export const CompleteDealAttachmentIngestionInputSchema = z.object({
  appliedFields: z.array(z.string()).default([]),
  appliedRevision: z.number().int().positive().nullable(),
  dealId: z.uuid(),
  fileAssetId: z.uuid(),
  normalizedPayload: DealAttachmentIngestionNormalizedPayloadSchema.nullable(),
  skippedFields: z.array(z.string()).default([]),
});

export type CompleteDealAttachmentIngestionInput = z.infer<
  typeof CompleteDealAttachmentIngestionInputSchema
>;

export const FailDealAttachmentIngestionInputSchema = z.object({
  errorCode: nullableShortText,
  errorMessage: nullableText,
  fileAssetId: z.uuid(),
  retryAt: z.coerce.date().nullable().optional().default(null),
  status: DealAttachmentIngestionStatusSchema.optional(),
});

export type FailDealAttachmentIngestionInput = z.infer<
  typeof FailDealAttachmentIngestionInputSchema
>;

export const PortalSettlementDestinationInputSchema = z.object({
  bankInstructionSnapshot: z
    .object({
      accountNo: nullableShortText,
      bankAddress: nullableText,
      bankCountry: nullableShortText,
      bankName: nullableShortText,
      beneficiaryName: nullableShortText,
      bic: nullableShortText,
      corrAccount: nullableShortText,
      iban: nullableShortText,
      label: nullableShortText,
      swift: nullableShortText,
    })
    .nullable()
    .optional()
    .default(null),
  mode: DealSettlementDestinationModeSchema.nullable().optional().default(null),
  requisiteId: z.uuid().nullable().optional().default(null),
});

export type PortalSettlementDestinationInput = z.infer<
  typeof PortalSettlementDestinationInputSchema
>;

export const PortalIncomingReceiptInputSchema = z.object({
  contractNumber: nullableShortText,
  expectedAmount: nullableDecimalText,
  expectedAt: nullableDateText.optional(),
  expectedCurrencyId: z.uuid().nullable().optional(),
  invoiceNumber: nullableShortText,
});

export type PortalIncomingReceiptInput = z.infer<
  typeof PortalIncomingReceiptInputSchema
>;
