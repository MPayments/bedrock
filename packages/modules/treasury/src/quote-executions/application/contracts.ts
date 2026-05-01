import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import {
  PaymentStepOriginSchema,
  PostingDocumentRefSchema,
} from "../../payment-steps/contracts/dto";
import {
  QuoteExecutionSchema,
  QuoteExecutionPartiesSchema,
  QuoteExecutionStateSchema,
} from "../contracts/dto";

const OptionalFailureReasonSchema =
  z.string().trim().max(1000).nullable().optional().default(null);
const OptionalProviderRefSchema =
  z.string().trim().min(1).max(255).nullable().optional().default(null);

export const CreateQuoteExecutionInputSchema = z
  .object({
    dealId: z.uuid().nullable().optional().default(null),
    fromAmountMinor: z.bigint().positive(),
    fromCurrencyId: z.uuid(),
    id: z.uuid().optional(),
    initialState: z
      .enum([
        QuoteExecutionStateSchema.enum.draft,
        QuoteExecutionStateSchema.enum.pending,
      ])
      .optional()
      .default("draft"),
    origin: PaymentStepOriginSchema,
    quoteId: z.uuid(),
    quoteLegIdx: z.number().int().positive().nullable().optional().default(null),
    quoteSnapshot: z.unknown().optional().default(null),
    rateDen: z.bigint().positive().optional(),
    rateNum: z.bigint().positive().optional(),
    executionParties: QuoteExecutionPartiesSchema.nullable()
      .optional()
      .default(null),
    sourceRef: z.string().trim().min(1).max(512),
    toAmountMinor: z.bigint().positive(),
    toCurrencyId: z.uuid(),
    treasuryOrderId: z.uuid().nullable().optional().default(null),
  })
  .superRefine((value, context) => {
    if (
      value.origin.type === "deal_execution_leg" &&
      (value.dealId === null ||
        value.origin.dealId !== value.dealId ||
        value.origin.planLegId === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Deal quote executions require origin.type=deal_execution_leg and origin.planLegId",
        path: ["origin"],
      });
    }
    if (
      value.origin.type === "treasury_order_step" &&
      (value.treasuryOrderId === null ||
        value.origin.treasuryOrderId !== value.treasuryOrderId ||
        value.origin.planLegId === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Treasury order quote executions require origin.type=treasury_order_step and origin.planLegId",
        path: ["origin"],
      });
    }
  });

export const SubmitQuoteExecutionInputSchema = z.object({
  executionId: z.uuid(),
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: z.unknown().optional().default(null),
});

export const AmendQuoteExecutionInputSchema = z.object({
  executionId: z.uuid(),
  executionParties: QuoteExecutionPartiesSchema,
});

export const ConfirmQuoteExecutionInputSchema = z.object({
  executionId: z.uuid(),
  failureReason: OptionalFailureReasonSchema,
  outcome: z.enum(["settled", "failed"]),
});

export const CancelQuoteExecutionInputSchema = z.object({
  executionId: z.uuid(),
});

export const ExpireQuoteExecutionInputSchema = z.object({
  executionId: z.uuid(),
});

export const AttachQuoteExecutionPostingInputSchema = z.object({
  documentId: PostingDocumentRefSchema.shape.documentId,
  executionId: z.uuid(),
  kind: PostingDocumentRefSchema.shape.kind,
});

export const GetQuoteExecutionByIdInputSchema = z.object({
  executionId: z.uuid(),
});

export const ListQuoteExecutionsQuerySchema = z.object({
  dealId: z.uuid().optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  quoteId: z.uuid().optional(),
  state: QuoteExecutionStateSchema.optional(),
  treasuryOrderId: z.uuid().optional(),
});

export const QuoteExecutionListResponseSchema = createPaginatedListSchema(
  QuoteExecutionSchema,
);

export type AttachQuoteExecutionPostingInput = z.infer<
  typeof AttachQuoteExecutionPostingInputSchema
>;
export type AmendQuoteExecutionInput = z.infer<
  typeof AmendQuoteExecutionInputSchema
>;
export type CancelQuoteExecutionInput = z.infer<
  typeof CancelQuoteExecutionInputSchema
>;
export type ConfirmQuoteExecutionInput = z.infer<
  typeof ConfirmQuoteExecutionInputSchema
>;
export type CreateQuoteExecutionInput = z.infer<
  typeof CreateQuoteExecutionInputSchema
>;
export type ExpireQuoteExecutionInput = z.infer<
  typeof ExpireQuoteExecutionInputSchema
>;
export type GetQuoteExecutionByIdInput = z.infer<
  typeof GetQuoteExecutionByIdInputSchema
>;
export type ListQuoteExecutionsQuery = z.infer<
  typeof ListQuoteExecutionsQuerySchema
>;
export type QuoteExecutionListResponse = z.infer<
  typeof QuoteExecutionListResponseSchema
>;
export type SubmitQuoteExecutionInput = z.infer<
  typeof SubmitQuoteExecutionInputSchema
>;
