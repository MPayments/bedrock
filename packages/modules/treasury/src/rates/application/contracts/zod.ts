import { z } from "zod";

import { TREASURY_RATE_SOURCES } from "../../domain/rate-source";

export const RateSourceSchema = z.enum(TREASURY_RATE_SOURCES);

export const RateSchema = z.object({
  source: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  asOf: z.iso.datetime(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
});

export const RatePairSchema = z.object({
  baseCurrencyCode: z.string(),
  quoteCurrencyCode: z.string(),
  bestRate: RateSchema,
  rates: z.array(RateSchema),
});

export const RatePairsResponseSchema = z.object({
  data: z.array(RatePairSchema),
});

export const RateHistoryPointSchema = z.object({
  source: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  asOf: z.iso.datetime(),
});

export const RateHistoryResponseSchema = z.object({
  data: z.array(RateHistoryPointSchema),
});

export const RateSourceStatusSchema = z.object({
  source: RateSourceSchema,
  ttlSeconds: z.number().int().positive(),
  lastSyncedAt: z.iso.datetime().nullable(),
  lastPublishedAt: z.iso.datetime().nullable(),
  lastStatus: z.enum(["idle", "ok", "error"]),
  lastError: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  isExpired: z.boolean(),
});

export const RateSourceStatusesResponseSchema = z.object({
  data: z.array(RateSourceStatusSchema),
});
