import { OpenAPIHono, z } from "@hono/zod-openapi";

import { ConnectorProviderNotConfiguredError } from "@bedrock/connectors";

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

function errorResponse(c: any, error: unknown) {
  if (error instanceof ConnectorProviderNotConfiguredError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof z.ZodError) {
    return c.json({ error: "Validation error", details: error.flatten() }, 400);
  }
  if (error instanceof Error) {
    return c.json({ error: error.message }, 400);
  }
  return c.json({ error: String(error) }, 400);
}

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
        return errorResponse(c, error);
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
        return errorResponse(c, error);
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
        return errorResponse(c, error);
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
        return errorResponse(c, error);
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
        const result = await ctx.connectorsService.ingestStatementBatch({
          providerCode,
          cursorKey: body.cursorKey,
          cursorValue: body.cursorValue,
          records: body.records,
          idempotencyKey: `${providerCode}:manual-statement:${Date.now()}`,
          actorUserId: c.get("user")?.id,
        });
        return c.json(toJsonSafe(result));
      } catch (error) {
        return errorResponse(c, error);
      }
    },
  );

  app.post(
    "/providers/:providerCode/webhook",
    requirePermission({ connectors: ["webhook"] }),
    async (c) => {
      try {
        const { providerCode } = c.req.param();
        const provider = ctx.connectorsService.providers[providerCode];
        if (!provider) {
          throw new ConnectorProviderNotConfiguredError(providerCode);
        }

        const rawPayload = (await c.req.json()) as Record<string, unknown>;
        const headers = Object.fromEntries(c.req.raw.headers.entries());
        const parsed = await provider.verifyAndParseWebhook({
          rawPayload,
          headers,
        });

        const event = await ctx.connectorsService.handleWebhookEvent({
          providerCode,
          eventType: parsed.eventType,
          webhookIdempotencyKey: parsed.webhookIdempotencyKey,
          signatureValid: parsed.signatureValid,
          rawPayload,
          parsedPayload: parsed.parsedPayload ?? undefined,
          intentId: parsed.intentId,
          attemptId: parsed.attemptId,
          status: parsed.status,
          externalAttemptRef: parsed.externalAttemptRef ?? undefined,
          error: parsed.error ?? undefined,
          idempotencyKey: `${providerCode}:${parsed.webhookIdempotencyKey}`,
          actorUserId: c.get("user")?.id,
        });

        if (
          parsed.signatureValid &&
          parsed.attemptId &&
          (parsed.status === "succeeded" || parsed.status === "failed_terminal")
        ) {
          const attempt = await ctx.connectorsService.getAttemptById(parsed.attemptId);
          if (attempt) {
            const intent = await ctx.connectorsService.getIntentById(attempt.intentId);
            if (intent) {
              await ctx.paymentsService.createResolution({
                payload: {
                  intentDocumentId: intent.documentId,
                  resolutionType:
                    parsed.status === "succeeded" ? "settle" : "fail",
                  eventIdempotencyKey: parsed.webhookIdempotencyKey,
                  externalRef: parsed.externalAttemptRef ?? undefined,
                  occurredAt: new Date(),
                },
                actorUserId: c.get("user")!.id,
                idempotencyKey: `${providerCode}:${parsed.webhookIdempotencyKey}:resolution`,
              });
            }
          }
        }

        return c.json(toJsonSafe(event), 202);
      } catch (error) {
        return errorResponse(c, error);
      }
    },
  );

  return app;
}
