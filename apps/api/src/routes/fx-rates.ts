import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  RateNotFoundError,
  RateSourceStaleError,
  RateSourceSyncError,
  ValidationError,
} from "@bedrock/fx";
import {
  FxRateHistoryResponseSchema,
  FxRatePairsResponseSchema,
  FxRateSourceSchema,
  FxRateSourceStatusesResponseSchema,
  FxRateSourceStatusSchema,
  //FxRateSchema,
  //FxRatePairSchema,
  SetManualRateInputSchema,
  SetManualRateResponseSchema,
} from "@bedrock/fx/contracts";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

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

export function fxRatesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const pairsRoute = createRoute({
    middleware: [requirePermission({ fx_rates: ["list"] })],
    method: "get",
    path: "/pairs",
    tags: ["FX"],
    summary: "List all currency pairs with rates by source",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FxRatePairsResponseSchema,
          },
        },
        description: "All currency pairs with latest rates grouped by source",
      },
    },
  });

  const setManualRateRoute = createRoute({
    middleware: [requirePermission({ fx_rates: ["sync"] })],
    method: "post",
    path: "/manual",
    tags: ["FX"],
    summary: "Set a manual FX rate",
    request: {
      body: {
        content: {
          "application/json": {
            schema: SetManualRateInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: SetManualRateResponseSchema,
          },
        },
        description: "Manual rate created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation error",
      },
    },
  });

  const latestRateRoute = createRoute({
    middleware: [requirePermission({ fx_rates: ["list"] })],
    method: "get",
    path: "/latest",
    tags: ["FX"],
    summary: "Get latest FX rate",
    request: {
      query: LatestRateQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: LatestRateResponseSchema,
          },
        },
        description: "Latest available FX rate",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Rate not found",
      },
      503: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Rate source is unavailable",
      },
    },
  });

  const sourceStatusesRoute = createRoute({
    middleware: [requirePermission({ fx_rates: ["list"] })],
    method: "get",
    path: "/sources",
    tags: ["FX"],
    summary: "List FX rate source statuses",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FxRateSourceStatusesResponseSchema,
          },
        },
        description: "Current source statuses",
      },
    },
  });

  const syncSourceRoute = createRoute({
    middleware: [requirePermission({ fx_rates: ["sync"] })],
    method: "post",
    path: "/sources/{source}/sync",
    tags: ["FX"],
    summary: "Trigger FX rate source sync",
    request: {
      params: SyncRateSourceParamsSchema,
      query: SyncRateSourceQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: SyncRateSourceResponseSchema,
          },
        },
        description: "Source sync result",
      },
      503: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Sync failed",
      },
    },
  });

  const rateHistoryRoute = createRoute({
    middleware: [requirePermission({ fx_rates: ["list"] })],
    method: "get",
    path: "/history",
    tags: ["FX"],
    summary: "Get rate history for a currency pair",
    request: {
      query: RateHistoryQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FxRateHistoryResponseSchema,
          },
        },
        description: "Rate history for the pair",
      },
    },
  });

  return app
    .openapi(rateHistoryRoute, async (c) => {
      const { base, quote, limit, from } = c.req.valid("query");
      const points = await ctx.fxService.getRateHistory({
        base,
        quote,
        limit,
        from,
      });
      return c.json(
        {
          data: points.map((p) => ({
            source: p.source,
            rateNum: p.rateNum.toString(),
            rateDen: p.rateDen.toString(),
            asOf: p.asOf.toISOString(),
          })),
        },
        200,
      );
    })
    .openapi(pairsRoute, async (c) => {
      const pairs = await ctx.fxService.listPairs();
      return c.json(
        {
          data: pairs.map((pair) => ({
            baseCurrencyCode: pair.baseCurrencyCode,
            quoteCurrencyCode: pair.quoteCurrencyCode,
            bestRate: serializeSourceRate(pair.bestRate),
            rates: pair.rates.map(serializeSourceRate),
          })),
        },
        200,
      );
    })
    .openapi(setManualRateRoute, async (c) => {
      const body = c.req.valid("json");
      try {
        await ctx.fxService.setManualRate({
          base: body.base.trim().toUpperCase(),
          quote: body.quote.trim().toUpperCase(),
          rateNum: BigInt(body.rateNum),
          rateDen: BigInt(body.rateDen),
          asOf: body.asOf ?? new Date(),
        });
        return c.json({ ok: true }, 201);
      } catch (error) {
        if (error instanceof ValidationError) {
          return c.json({ error: error.message }, 400);
        }
        throw error;
      }
    })
    .openapi(latestRateRoute, async (c) => {
      const { base, quote, asOf } = c.req.valid("query");

      try {
        const rate = await ctx.fxService.getLatestRate(
          base,
          quote,
          asOf ?? new Date(),
        );
        return c.json(
          {
            base: base.trim().toUpperCase(),
            quote: quote.trim().toUpperCase(),
            rateNum: rate.rateNum.toString(),
            rateDen: rate.rateDen.toString(),
            source: rate.source,
            asOf: rate.asOf.toISOString(),
          },
          200,
        );
      } catch (error) {
        if (error instanceof RateNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (
          error instanceof RateSourceStaleError ||
          error instanceof RateSourceSyncError
        ) {
          return c.json({ error: error.message }, 503);
        }
        throw error;
      }
    })
    .openapi(sourceStatusesRoute, async (c) => {
      const statuses = await ctx.fxService.getRateSourceStatuses();
      return c.json(
        {
          data: statuses.map((status) => serializeSourceStatus(status)),
        },
        200,
      );
    })
    .openapi(syncSourceRoute, async (c) => {
      const { source } = c.req.valid("param");
      const { force } = c.req.valid("query");

      try {
        const result = await ctx.fxService.syncRatesFromSource({
          source,
          force: force ?? false,
        });
        return c.json(
          {
            source: result.source,
            synced: result.synced,
            rateCount: result.rateCount,
            publishedAt: result.publishedAt?.toISOString() ?? null,
            status: serializeSourceStatus(result.status),
          },
          200,
        );
      } catch (error) {
        if (
          error instanceof RateSourceSyncError ||
          error instanceof RateSourceStaleError
        ) {
          return c.json({ error: error.message }, 503);
        }
        throw error;
      }
    });
}

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
