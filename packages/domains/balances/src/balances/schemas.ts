import { z } from "zod";

export const BalanceSnapshotSchema = z.object({
  bookId: z.uuid(),
  subjectType: z.string(),
  subjectId: z.string(),
  currency: z.string(),
  ledgerBalance: z.string(),
  available: z.string(),
  reserved: z.string(),
  pending: z.string(),
  version: z.number().int(),
});

export const BalanceHoldSnapshotSchema = z.object({
  id: z.uuid(),
  holdRef: z.string(),
  amount: z.string(),
  state: z.string(),
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  releasedAt: z.iso.datetime().nullable(),
  consumedAt: z.iso.datetime().nullable(),
});

export const BalanceMutationResultSchema = z.object({
  balance: BalanceSnapshotSchema,
  hold: BalanceHoldSnapshotSchema.nullable(),
});
