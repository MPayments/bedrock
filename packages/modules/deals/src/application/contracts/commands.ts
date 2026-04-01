import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import {
  DealIntakeDraftSchema,
  DealSettlementDestinationModeSchema,
} from "./dto";
import {
  DealCapabilityKindSchema,
  DealCapabilityStatusSchema,
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

export const CreateDealInputSchema = z
  .object({
    agentId: nullableShortText,
    agreementId: z.uuid().optional(),
    calculationId: z.uuid().nullable().optional(),
    comment: nullableText,
    counterpartyId: z.uuid().optional(),
    customerId: z.uuid(),
    intakeComment: nullableText,
    reason: nullableText,
    requestedAmount: nullableDecimalText,
    requestedCurrencyId: z.uuid().nullable().optional(),
    type: DealTypeSchema,
  })
  .superRefine((value, ctx) => {
    const hasRequestedAmount = value.requestedAmount !== null;
    const hasRequestedCurrencyId = value.requestedCurrencyId != null;

    if (hasRequestedAmount !== hasRequestedCurrencyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "requestedAmount and requestedCurrencyId must be provided together",
        path: hasRequestedAmount ? ["requestedCurrencyId"] : ["requestedAmount"],
      });
    }
  });

export type CreateDealInput = z.infer<typeof CreateDealInputSchema>;

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
      expectedCurrencyId: z.uuid().nullable().optional().default(null),
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
    sourceCurrencyId: z.uuid().nullable(),
    targetCurrencyId: z.uuid().nullable().optional().default(null),
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

export const UpdateDealIntakeInputSchema = z
  .object({
    agentId: nullableShortText.optional(),
    comment: nullableText.optional(),
    counterpartyId: z.uuid().nullable().optional(),
    intakeComment: nullableText.optional(),
    reason: nullableText.optional(),
    requestedAmount: nullableDecimalText.optional(),
    requestedCurrencyId: z.uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasRequestedAmount = value.requestedAmount !== undefined;
    const hasRequestedCurrencyId = value.requestedCurrencyId !== undefined;

    if (hasRequestedAmount !== hasRequestedCurrencyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "requestedAmount and requestedCurrencyId must be patched together",
        path: hasRequestedAmount ? ["requestedCurrencyId"] : ["requestedAmount"],
      });
    }
  });

export type UpdateDealIntakeInput = z.infer<typeof UpdateDealIntakeInputSchema>;

export const LinkDealCalculationFromAcceptedQuoteInputSchema = z.object({
  calculationId: z.uuid(),
  quoteId: z.uuid(),
});

export type LinkDealCalculationFromAcceptedQuoteInput = z.infer<
  typeof LinkDealCalculationFromAcceptedQuoteInputSchema
>;

export const AcceptDealQuoteInputSchema = z.object({
  quoteId: z.uuid(),
});

export type AcceptDealQuoteInput = z.infer<typeof AcceptDealQuoteInputSchema>;

export const AppendDealTimelineEventInputSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  sourceRef: nullableShortText,
  type: z.enum([
    "quote_created",
    "quote_accepted",
    "quote_expired",
    "quote_used",
    "attachment_uploaded",
    "attachment_deleted",
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

export const ListDealCapabilityStatesQuerySchema = z.object({
  applicantCounterpartyId: z.uuid().optional(),
  capabilityKind: DealCapabilityKindSchema.optional(),
  dealType: DealTypeSchema.optional(),
  internalEntityOrganizationId: z.uuid().optional(),
  status: DealCapabilityStatusSchema.optional(),
});

export type ListDealCapabilityStatesQuery = z.infer<
  typeof ListDealCapabilityStatesQuerySchema
>;

export const UpsertDealCapabilityStateInputSchema = z.object({
  applicantCounterpartyId: z.uuid(),
  capabilityKind: DealCapabilityKindSchema,
  dealType: DealTypeSchema,
  internalEntityOrganizationId: z.uuid(),
  note: nullableText,
  reasonCode: nullableShortText,
  status: DealCapabilityStatusSchema,
});

export type UpsertDealCapabilityStateInput = z.infer<
  typeof UpsertDealCapabilityStateInputSchema
>;

export const LegacyPortalCreateDealInputSchema = z.object({
  counterpartyId: z.uuid(),
  requestedAmount: nullableDecimalText.optional(),
  requestedCurrency: z.string().trim().min(3).max(16).optional(),
});

export type LegacyPortalCreateDealInput = z.infer<
  typeof LegacyPortalCreateDealInputSchema
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
