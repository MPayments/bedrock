import { z } from "zod";

import { baseOccurredAtSchema, memoSchema } from "./shared";

export const TransferResolutionInputSchema = baseOccurredAtSchema.extend({
  transferDocumentId: z.uuid(),
  resolutionType: z.enum(["settle", "void", "fail"]),
  eventIdempotencyKey: z.string().trim().min(1).max(255),
  pendingIndex: z.number().int().min(0).default(0),
  memo: memoSchema,
});

export type TransferResolutionInput = z.infer<typeof TransferResolutionInputSchema>;
export type TransferResolutionPayload = z.infer<typeof TransferResolutionInputSchema>;
