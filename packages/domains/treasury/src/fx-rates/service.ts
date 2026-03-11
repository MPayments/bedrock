import { defineService, error } from "@bedrock/core";
import {
  RateNotFoundError,
  RateSourceStaleError,
  RateSourceSyncError,
  ValidationError,
} from "@multihansa/treasury/fx";
import {
  FxRateHistoryResponseSchema,
  FxRatePairsResponseSchema,
  FxRateSourceSchema,
  FxRateSourceStatusSchema,
  FxRateSourceStatusesResponseSchema,
  SetManualRateInputSchema,
  SetManualRateResponseSchema,
} from "@multihansa/treasury/fx/contracts";
import { z } from "zod";

import {
  BadRequestDomainError,
  NotFoundDomainError,
  ServiceUnavailableDomainError,
} from "@multihansa/common/bedrock";
import { FxDomainServiceToken } from "../tokens";

const LatestRateQuerySchema = z.object({
  base: z.string().min(2).max(16),
  quote: z.string().min(2).max(16),
  asOf: z.coerce.date().optional(),
});

const LatestRateResponseSchema = z.object({
  base: z.string(),
  quote: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  source: z.string(),
  asOf: z.iso.datetime(),
});

const SyncRateSourceParamsSchema = z.object({
  source: FxRateSourceSchema,
});

const SyncRateSourceQuerySchema = z.object({
  force: z.coerce.boolean().optional(),
});

const SyncRateSourceInputSchema = SyncRateSourceParamsSchema.extend({
  force: SyncRateSourceQuerySchema.shape.force,
});

const SyncRateSourceResponseSchema = z.object({
  source: FxRateSourceSchema,
  synced: z.boolean(),
  rateCount: z.number().int().nonnegative(),
  publishedAt: z.iso.datetime().nullable(),
  status: FxRateSourceStatusSchema,
});

const RateHistoryQuerySchema = z.object({
  base: z.string().min(2).max(16),
  quote: z.string().min(2).max(16),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  from: z.coerce.date().optional(),
});

function serializeSourceRate(rate: {
  source: string;
  rateNum: bigint;
  rateDen: bigint;
  asOf: Date;
  change: number | null;
  changePercent: number | null;
}) {
  return {
    source: rate.source,
    rateNum: rate.rateNum.toString(),
    rateDen: rate.rateDen.toString(),
    asOf: rate.asOf.toISOString(),
    change: rate.change,
    changePercent: rate.changePercent,
  };
}

function serializeSourceStatus(status: {
  source: "cbr" | "investing" | "xe";
  ttlSeconds: number;
  lastSyncedAt: Date | null;
  lastPublishedAt: Date | null;
  lastStatus: "idle" | "ok" | "error";
  lastError: string | null;
  expiresAt: Date | null;
  isExpired: boolean;
}) {
  return {
    source: status.source,
    ttlSeconds: status.ttlSeconds,
    lastSyncedAt: status.lastSyncedAt?.toISOString() ?? null,
    lastPublishedAt: status.lastPublishedAt?.toISOString() ?? null,
    lastStatus: status.lastStatus,
    lastError: status.lastError,
    expiresAt: status.expiresAt?.toISOString() ?? null,
    isExpired: status.isExpired,
  };
}

export const fxRatesService = defineService("fx-rates", {
  deps: {
    fx: FxDomainServiceToken,
  },
  ctx: ({ fx }) => ({
    fx,
  }),
  actions: ({ action }) => ({
    history: action({
      input: RateHistoryQuerySchema,
      output: FxRateHistoryResponseSchema,
      handler: async ({ ctx, input }) => {
        const points = await ctx.fx.getRateHistory(input);
        return {
          data: points.map((point) => ({
            source: point.source,
            rateNum: point.rateNum.toString(),
            rateDen: point.rateDen.toString(),
            asOf: point.asOf.toISOString(),
          })),
        };
      },
    }),
    pairs: action({
      output: FxRatePairsResponseSchema,
      handler: async ({ ctx }) => {
        const pairs = await ctx.fx.listPairs();
        return {
          data: pairs.map((pair) => ({
            baseCurrencyCode: pair.baseCurrencyCode,
            quoteCurrencyCode: pair.quoteCurrencyCode,
            bestRate: serializeSourceRate(pair.bestRate),
            rates: pair.rates.map(serializeSourceRate),
          })),
        };
      },
    }),
    setManualRate: action({
      input: SetManualRateInputSchema,
      output: SetManualRateResponseSchema,
      errors: [BadRequestDomainError],
      handler: async ({ ctx, input }) => {
        try {
          await ctx.fx.setManualRate({
            base: input.base.trim().toUpperCase(),
            quote: input.quote.trim().toUpperCase(),
            rateNum: BigInt(input.rateNum),
            rateDen: BigInt(input.rateDen),
            asOf: input.asOf ?? new Date(),
          });

          return {
            ok: true,
          };
        } catch (cause) {
          if (cause instanceof ValidationError) {
            return error(BadRequestDomainError, { message: cause.message });
          }

          throw cause;
        }
      },
    }),
    latest: action({
      input: LatestRateQuerySchema,
      output: LatestRateResponseSchema,
      errors: [NotFoundDomainError, ServiceUnavailableDomainError],
      handler: async ({ ctx, input }) => {
        try {
          const rate = await ctx.fx.getLatestRate(
            input.base,
            input.quote,
            input.asOf ?? new Date(),
          );

          return {
            base: input.base.trim().toUpperCase(),
            quote: input.quote.trim().toUpperCase(),
            rateNum: rate.rateNum.toString(),
            rateDen: rate.rateDen.toString(),
            source: rate.source,
            asOf: rate.asOf.toISOString(),
          };
        } catch (cause) {
          if (cause instanceof RateNotFoundError) {
            return error(NotFoundDomainError, { message: cause.message });
          }
          if (
            cause instanceof RateSourceStaleError ||
            cause instanceof RateSourceSyncError
          ) {
            return error(ServiceUnavailableDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
    sourceStatuses: action({
      output: FxRateSourceStatusesResponseSchema,
      handler: async ({ ctx }) => {
        const statuses = await ctx.fx.getRateSourceStatuses();
        return {
          data: statuses.map((status) => serializeSourceStatus(status)),
        };
      },
    }),
    syncSource: action({
      input: SyncRateSourceInputSchema,
      output: SyncRateSourceResponseSchema,
      errors: [ServiceUnavailableDomainError],
      handler: async ({ ctx, input }) => {
        try {
          const result = await ctx.fx.syncRatesFromSource({
            source: input.source,
            force: input.force ?? false,
          });
          return {
            source: result.source,
            synced: result.synced,
            rateCount: result.rateCount,
            publishedAt: result.publishedAt?.toISOString() ?? null,
            status: serializeSourceStatus(result.status),
          };
        } catch (cause) {
          if (
            cause instanceof RateSourceSyncError ||
            cause instanceof RateSourceStaleError
          ) {
            return error(ServiceUnavailableDomainError, {
              message: cause.message,
            });
          }

          throw cause;
        }
      },
    }),
  }),
});

export {
  LatestRateQuerySchema,
  LatestRateResponseSchema,
  RateHistoryQuerySchema,
  SyncRateSourceParamsSchema,
  SyncRateSourceQuerySchema,
  SyncRateSourceResponseSchema,
};
