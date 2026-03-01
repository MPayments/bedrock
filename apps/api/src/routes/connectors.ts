import { OpenAPIHono, z } from "@hono/zod-openapi";

import { handleRouteError } from "../common/errors";
import { toJsonSafe } from "../common/json";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

const UpsertProviderInputSchema = z.object({
  status: z.enum(["up", "degraded", "down"]),
  score: z.number().int().min(0).max(100),
  error: z.string().trim().min(1).optional(),
});

const ListAttemptsQuerySchema = z.object({
  intentId: z.uuid().optional(),
  status: z
    .enum([
      "queued",
      "dispatching",
      "submitted",
      "pending",
      "succeeded",
      "failed_retryable",
      "failed_terminal",
      "cancelled",
    ])
    .optional(),
  providerCode: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const ListEventsQuerySchema = z.object({
  providerCode: z.string().trim().min(1).optional(),
  intentId: z.uuid().optional(),
  attemptId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const ManualStatementIngestSchema = z.object({
  cursorKey: z.string().trim().min(1).default("default"),
  cursorValue: z.string().trim().min(1).optional(),
  records: z.array(
    z.object({
      recordId: z.string().trim().min(1),
      occurredAt: z.coerce.date(),
      payload: z.record(z.string(), z.unknown()),
    }),
  ),
});

export function connectorsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.get(
    "/providers",
    requirePermission({ connectors: ["list"] }),
    async (c) => {
      try {
        const rows = await ctx.connectorsService.listProviderHealth();
        return c.json(toJsonSafe(rows));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.put(
    "/providers/:providerCode",
    requirePermission({ connectors: ["manage"] }),
    async (c) => {
      try {
        const { providerCode } = c.req.param();
        const body = UpsertProviderInputSchema.parse(await c.req.json());
        const row = await ctx.connectorsService.upsertProviderHealth({
          providerCode,
          status: body.status,
          score: body.score,
          error: body.error ?? null,
        });
        return c.json(toJsonSafe(row));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get(
    "/attempts",
    requirePermission({ connectors: ["list"] }),
    async (c) => {
      try {
        const query = ListAttemptsQuerySchema.parse(
          Object.fromEntries(new URL(c.req.url).searchParams.entries()),
        );
        const rows = await ctx.connectorsService.listAttempts({
          intentId: query.intentId,
          status: query.status,
          providerCode: query.providerCode,
          limit: query.limit,
          offset: query.offset,
        });
        return c.json(toJsonSafe(rows));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get(
    "/events",
    requirePermission({ connectors: ["list"] }),
    async (c) => {
      try {
        const query = ListEventsQuerySchema.parse(
          Object.fromEntries(new URL(c.req.url).searchParams.entries()),
        );
        const rows = await ctx.connectorsService.listEvents({
          providerCode: query.providerCode,
          intentId: query.intentId,
          attemptId: query.attemptId,
          limit: query.limit,
          offset: query.offset,
        });
        return c.json(toJsonSafe(rows));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.post(
    "/providers/:providerCode/statements/ingest",
    requirePermission({ connectors: ["manage"] }),
    async (c) => {
      try {
        const { providerCode } = c.req.param();
        const body = ManualStatementIngestSchema.parse(await c.req.json());
        const recordFingerprint = body.records
          .map((record) => record.recordId.trim())
          .sort((left, right) => left.localeCompare(right))
          .join(",");
        const result = await ctx.connectorsService.ingestStatementBatch({
          providerCode,
          cursorKey: body.cursorKey,
          cursorValue: body.cursorValue,
          records: body.records,
          idempotencyKey: `${providerCode}:manual-statement:${body.cursorKey}:${recordFingerprint || "empty"}`,
          actorUserId: c.get("user")?.id,
        });
        return c.json(toJsonSafe(result));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  return app;
}
