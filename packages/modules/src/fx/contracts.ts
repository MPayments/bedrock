import { z } from "zod";

export const FxRateSourceSchema = z.enum(["cbr", "investing"]);

export const FxRateSchema = z.object({
  source: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  asOf: z.iso.datetime(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
});

export const FxRatePairSchema = z.object({
  baseCurrencyCode: z.string(),
  quoteCurrencyCode: z.string(),
  bestRate: FxRateSchema,
  rates: z.array(FxRateSchema),
});

export const FxRatePairsResponseSchema = z.object({
  data: z.array(FxRatePairSchema),
});

export const FxRateSourceStatusSchema = z.object({
  source: FxRateSourceSchema,
  ttlSeconds: z.number().int().positive(),
  lastSyncedAt: z.iso.datetime().nullable(),
  lastPublishedAt: z.iso.datetime().nullable(),
  lastStatus: z.enum(["idle", "ok", "error"]),
  lastError: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  isExpired: z.boolean(),
});

export const FxRateSourceStatusesResponseSchema = z.object({
  data: z.array(FxRateSourceStatusSchema),
});

export const SetManualRateInputSchema = z.object({
  base: z.string().min(2).max(16),
  quote: z.string().min(2).max(16),
  rateNum: z.string().regex(/^\d+$/, "Must be a non-negative integer string"),
  rateDen: z.string().regex(/^\d+$/, "Must be a non-negative integer string"),
  asOf: z.coerce.date().optional(),
});

export const SetManualRateResponseSchema = z.object({
  ok: z.boolean(),
});

export type FxRatePair = z.infer<typeof FxRatePairSchema>;
export type FxRateSourceStatus = z.infer<typeof FxRateSourceStatusSchema>;
export type SetManualRateInput = z.infer<typeof SetManualRateInputSchema>;
