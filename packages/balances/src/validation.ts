import { z } from "zod";

export const BalanceSubjectSchema = z.object({
  bookId: z.string().min(1),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  currency: z.string().min(1),
});

export const ReserveBalanceInputSchema = z.object({
  subject: BalanceSubjectSchema,
  amountMinor: z.bigint().positive(),
  holdRef: z.string().min(1),
  reason: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
});

export const ReleaseBalanceInputSchema = z.object({
  subject: BalanceSubjectSchema,
  holdRef: z.string().min(1),
  reason: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
});

export const ConsumeBalanceInputSchema = z.object({
  subject: BalanceSubjectSchema,
  holdRef: z.string().min(1),
  reason: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
});

export type BalanceSubjectInput = z.infer<typeof BalanceSubjectSchema>;
export type ReserveBalanceInput = z.infer<typeof ReserveBalanceInputSchema>;
export type ReleaseBalanceInput = z.infer<typeof ReleaseBalanceInputSchema>;
export type ConsumeBalanceInput = z.infer<typeof ConsumeBalanceInputSchema>;

export function validateBalanceSubject(input: unknown): BalanceSubjectInput {
  return BalanceSubjectSchema.parse(input);
}

export function validateReserveBalanceInput(input: unknown): ReserveBalanceInput {
  return ReserveBalanceInputSchema.parse(input);
}

export function validateReleaseBalanceInput(input: unknown): ReleaseBalanceInput {
  return ReleaseBalanceInputSchema.parse(input);
}

export function validateConsumeBalanceInput(input: unknown): ConsumeBalanceInput {
  return ConsumeBalanceInputSchema.parse(input);
}
