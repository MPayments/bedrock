import { z } from "zod";

import { baseOccurredAtSchema, memoSchema } from "./shared";

export const FxResolutionTypeSchema = z.enum(["settle", "void", "fail"]);

export const FxResolutionInputSchema = baseOccurredAtSchema.extend({
  fxExecuteDocumentId: z.uuid(),
  resolutionType: FxResolutionTypeSchema,
  eventIdempotencyKey: z.string().trim().min(1).max(255),
  memo: memoSchema,
});

export const FxResolutionPayloadSchema = FxResolutionInputSchema;

export type FxResolutionInput = z.infer<typeof FxResolutionInputSchema>;
export type FxResolutionPayload = z.infer<typeof FxResolutionPayloadSchema>;
