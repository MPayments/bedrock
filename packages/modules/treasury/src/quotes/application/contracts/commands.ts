import { z } from "zod";

import {
  QuotePricingInputSchema,
} from "./zod";
import { uuidSchema } from "../../../fees/application/contracts/zod";

export const CreateQuoteInputSchema = z.object({
  dealId: uuidSchema.optional(),
  idempotencyKey: z.string().min(1).max(255),
}).and(QuotePricingInputSchema);

const markQuoteUsedDateInputSchema = z.union([
  z.date(),
  z.iso.datetime().transform((value) => new Date(value)),
]);

export const MarkQuoteUsedInputSchema = z.object({
  dealId: uuidSchema.nullish(),
  quoteId: uuidSchema,
  usedByRef: z.string().min(1).max(255),
  usedDocumentId: uuidSchema.nullish(),
  at: markQuoteUsedDateInputSchema,
});

export type CreateQuoteInput = z.infer<typeof CreateQuoteInputSchema>;
export type MarkQuoteUsedInput = z.infer<typeof MarkQuoteUsedInputSchema>;
