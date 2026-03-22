import { z } from "zod";

import { CompiledPack } from "../../domain";
import { PackChecksumSchema } from "./commands";

const NonEmptyStringRecordSchema = z.record(
  z.string().trim().min(1),
  z.string().trim().min(1),
);

export const LoadActivePackForBookInputSchema = z.object({
  bookId: z.string().trim().min(1),
  at: z.coerce.date().optional(),
});

export const DocumentPostingPlanRequestSchema = z.object({
  templateKey: z.string().trim().min(1),
  effectiveAt: z.coerce.date(),
  currency: z.string().trim().min(1),
  amountMinor: z.bigint(),
  bookRefs: NonEmptyStringRecordSchema,
  dimensions: NonEmptyStringRecordSchema,
  refs: NonEmptyStringRecordSchema.nullable().optional(),
  pending: z
    .object({
      ref: z.string().trim().min(1).nullable().optional(),
      pendingId: z.bigint().positive().optional(),
      timeoutSeconds: z.number().int().positive().optional(),
      amountMinor: z.bigint().optional(),
    })
    .nullable()
    .optional(),
  memo: z.string().trim().min(1).nullable().optional(),
});

export const DocumentPostingPlanSchema = z.object({
  operationCode: z.string().trim().min(1),
  operationVersion: z.number().int().positive().optional(),
  payload: z.record(z.string(), z.unknown()),
  requests: z.array(DocumentPostingPlanRequestSchema).min(1),
});

export const ResolvePostingPlanInputSchema = z.object({
  accountingSourceId: z.string().trim().min(1),
  source: z.object({
    type: z.string().trim().min(1),
    id: z.string().trim().min(1),
  }),
  idempotencyKey: z.string().trim().min(1),
  postingDate: z.coerce.date(),
  at: z.coerce.date().optional(),
  bookIdContext: z.string().trim().min(1).optional(),
  plan: DocumentPostingPlanSchema,
  pack: z.instanceof(CompiledPack).optional(),
});

export type LoadActivePackForBookInput = z.infer<
  typeof LoadActivePackForBookInputSchema
>;
export type DocumentPostingPlanRequestInput = z.infer<
  typeof DocumentPostingPlanRequestSchema
>;
export type DocumentPostingPlanInput = z.infer<
  typeof DocumentPostingPlanSchema
>;
export type ResolvePostingPlanQueryInput = z.infer<
  typeof ResolvePostingPlanInputSchema
>;

export { PackChecksumSchema };
