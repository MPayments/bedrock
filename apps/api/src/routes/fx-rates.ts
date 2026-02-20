import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { RateNotFoundError, RateSourceStaleError, RateSourceSyncError } from "@bedrock/fx";

import { ErrorSchema } from "../common";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const RateSourceSchema = z.enum(["cbr", "investing"]);

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
    asOf: z.string().datetime(),
});

const SourceStatusSchema = z.object({
    source: RateSourceSchema,
    ttlSeconds: z.number().int().positive(),
    lastSyncedAt: z.string().datetime().nullable(),
    lastPublishedAt: z.string().datetime().nullable(),
    lastStatus: z.enum(["idle", "ok", "error"]),
    lastError: z.string().nullable(),
    expiresAt: z.string().datetime().nullable(),
    isExpired: z.boolean(),
});

const SourceStatusesSchema = z.object({
    data: z.array(SourceStatusSchema),
});

const SyncRateSourceParamsSchema = z.object({
    source: RateSourceSchema,
});

const SyncRateSourceQuerySchema = z.object({
    force: z.coerce.boolean().optional(),
});

const SyncRateSourceResponseSchema = z.object({
    source: RateSourceSchema,
    synced: z.boolean(),
    rateCount: z.number().int().nonnegative(),
    publishedAt: z.string().datetime().nullable(),
    status: SourceStatusSchema,
});

export function fxRatesRoutes(ctx: AppContext) {
    const app = new OpenAPIHono<{ Variables: AuthVariables }>();

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
                        schema: SourceStatusesSchema,
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

    return app
        .openapi(latestRateRoute, async (c) => {
            const { base, quote, asOf } = c.req.valid("query");

            try {
                const rate = await ctx.fxService.getLatestRate(base, quote, asOf ?? new Date());
                return c.json({
                    base: base.trim().toUpperCase(),
                    quote: quote.trim().toUpperCase(),
                    rateNum: rate.rateNum.toString(),
                    rateDen: rate.rateDen.toString(),
                    source: rate.source,
                    asOf: rate.asOf.toISOString(),
                }, 200);
            } catch (error) {
                if (error instanceof RateNotFoundError) {
                    return c.json({ error: error.message }, 404);
                }
                if (error instanceof RateSourceStaleError || error instanceof RateSourceSyncError) {
                    return c.json({ error: error.message }, 503);
                }
                throw error;
            }
        })
        .openapi(sourceStatusesRoute, async (c) => {
            const statuses = await ctx.fxService.getRateSourceStatuses();
            return c.json({
                data: statuses.map((status) => serializeSourceStatus(status)),
            }, 200);
        })
        .openapi(syncSourceRoute, async (c) => {
            const { source } = c.req.valid("param");
            const { force } = c.req.valid("query");

            try {
                const result = await ctx.fxService.syncRatesFromSource({ source, force: force ?? false });
                return c.json({
                    source: result.source,
                    synced: result.synced,
                    rateCount: result.rateCount,
                    publishedAt: result.publishedAt?.toISOString() ?? null,
                    status: serializeSourceStatus(result.status),
                }, 200);
            } catch (error) {
                if (error instanceof RateSourceSyncError || error instanceof RateSourceStaleError) {
                    return c.json({ error: error.message }, 503);
                }
                throw error;
            }
        });
}

function serializeSourceStatus(status: {
    source: "cbr" | "investing";
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
