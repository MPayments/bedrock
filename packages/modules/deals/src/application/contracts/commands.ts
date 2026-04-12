import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import {
  DealAttachmentIngestionNormalizedPayloadSchema,
  DealIntakeDraftSchema,
  DealSettlementDestinationModeSchema,
} from "./dto";
import {
  DealAttachmentIngestionStatusSchema,
  DealLegStateSchema,
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
  type: DealTypeSchema,
});

export type CreatePortalDealInput = z.infer<typeof CreatePortalDealInputSchema>;

export const CreateDealDraftInputSchema = z.object({
  agreementId: z.uuid().optional(),
  customerId: z.uuid(),
  intake: DealIntakeDraftSchema,
});

export type CreateDealDraftInput = z.infer<typeof CreateDealDraftInputSchema>;

export const ReplaceDealIntakeInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  intake: DealIntakeDraftSchema,
});

export type ReplaceDealIntakeInput = z.infer<typeof ReplaceDealIntakeInputSchema>;

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

export const LinkDealCalculationFromAcceptedQuoteInputSchema = z.object({
  calculationId: z.uuid(),
  quoteId: z.uuid(),
});

export type LinkDealCalculationFromAcceptedQuoteInput = z.infer<
  typeof LinkDealCalculationFromAcceptedQuoteInputSchema
>;

export const LinkDealCalculationInputSchema = z.object({
  calculationId: z.uuid(),
  sourceQuoteId: z.uuid().nullable().optional(),
});

export type LinkDealCalculationInput = z.infer<
  typeof LinkDealCalculationInputSchema
>;

export const AcceptDealQuoteInputSchema = z.object({
  quoteId: z.uuid(),
});

export type AcceptDealQuoteInput = z.infer<typeof AcceptDealQuoteInputSchema>;

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
    "quote_accepted",
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
