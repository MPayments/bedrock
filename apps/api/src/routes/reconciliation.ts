import { OpenAPIHono, z } from "@hono/zod-openapi";

import { ValidationError } from "@bedrock/kernel/errors";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/core/idempotency";
import {
  ExternalRecordConflictError,
  ReconciliationExceptionNotFoundError,
  ReconciliationExternalRecordInputSchema,
  ReconciliationMatchNotFoundError,
  RunReconciliationInputSchema,
} from "@bedrock/core/reconciliation";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  requireIdempotencyKey,
} from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

const ListExceptionsQuerySchema = z.object({
  source: z.string().optional(),
  state: z.enum(["open", "resolved", "ignored"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const MatchIdParamSchema = z.object({
  matchId: z.uuid(),
});

const ExceptionIdParamSchema = z.object({
  exceptionId: z.uuid(),
});

const AdjustmentDocumentBodySchema = z.object({
  docType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  createIdempotencyKey: z.string().min(1).optional(),
});

function handleReconciliationError(
  c: { json: (body: unknown, status?: number) => Response },
  error: unknown,
) {
  if (
    error instanceof ValidationError ||
    error instanceof ExternalRecordConflictError
  ) {
    return c.json({ error: error.message }, 400);
  }
  if (
    error instanceof ReconciliationMatchNotFoundError ||
    error instanceof ReconciliationExceptionNotFoundError
  ) {
    return c.json({ error: error.message }, 404);
  }
  if (
    error instanceof ActionReceiptConflictError ||
    error instanceof ActionReceiptStoredError
  ) {
    return c.json({ error: error.message }, 409);
  }

  throw error;
}

function toExternalRecordDto(input: {
  id: string;
  source: string;
  sourceRecordId: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  payloadHash: string;
  normalizationVersion: number;
  receivedAt: Date;
}) {
  return {
    ...input,
    receivedAt: input.receivedAt.toISOString(),
  };
}

function toRunDto(input: {
  id: string;
  source: string;
  rulesetChecksum: string;
  inputQuery: Record<string, unknown>;
  resultSummary: Record<string, unknown>;
  createdAt: Date;
}) {
  return {
    ...input,
    createdAt: input.createdAt.toISOString(),
  };
}

export function reconciliationRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.post(
    "/external-records",
    requirePermission({ reconciliation: ["ingest"] }),
    async (c) => {
      try {
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const body = ReconciliationExternalRecordInputSchema.parse(
          await c.req.json(),
        );
        const result = await ctx.reconciliationService.ingestExternalRecord({
          ...body,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toExternalRecordDto(result), 201);
      } catch (error) {
        return handleReconciliationError(c, error);
      }
    },
  );

  app.post("/runs", requirePermission({ reconciliation: ["run"] }), async (c) => {
    try {
      const idem = requireIdempotencyKey(c);
      if (!idem.ok) return idem.response;
      const body = RunReconciliationInputSchema.pick({
        source: true,
        rulesetChecksum: true,
        inputQuery: true,
      }).parse(await c.req.json());
      const result = await ctx.reconciliationService.runReconciliation({
        ...body,
        actorUserId: c.get("user")!.id,
        idempotencyKey: idem.idempotencyKey,
        requestContext: getRequestContext(c),
      });
      return c.json(toRunDto(result));
    } catch (error) {
      return handleReconciliationError(c, error);
    }
  });

  app.get(
    "/exceptions",
    requirePermission({ reconciliation: ["list"] }),
    async (c) => {
      try {
        const query = ListExceptionsQuerySchema.parse(
          Object.fromEntries(new URL(c.req.url).searchParams.entries()),
        );
        const result = await ctx.reconciliationService.listExceptions(query);
        return c.json(
          result.map((row) => ({
            exception: {
              ...row.exception,
              createdAt: row.exception.createdAt.toISOString(),
              resolvedAt: row.exception.resolvedAt?.toISOString() ?? null,
            },
            run: toRunDto(row.run),
            externalRecord: toExternalRecordDto(row.externalRecord),
          })),
        );
      } catch (error) {
        return handleReconciliationError(c, error);
      }
    },
  );

  app.get(
    "/matches/:matchId/explanation",
    requirePermission({ reconciliation: ["explain"] }),
    async (c) => {
      try {
        const { matchId } = MatchIdParamSchema.parse(c.req.param());
        const result = await ctx.reconciliationService.explainMatch(matchId);
        return c.json(result);
      } catch (error) {
        return handleReconciliationError(c, error);
      }
    },
  );

  app.post(
    "/exceptions/:exceptionId/adjustment-document",
    requirePermission({ reconciliation: ["adjust"] }),
    async (c) => {
      try {
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const { exceptionId } = ExceptionIdParamSchema.parse(c.req.param());
        const body = AdjustmentDocumentBodySchema.parse(await c.req.json());
        const result =
          await ctx.reconciliationService.createAdjustmentDocument({
            exceptionId,
            docType: body.docType,
            payload: body.payload,
            createIdempotencyKey: body.createIdempotencyKey,
            actorUserId: c.get("user")!.id,
            idempotencyKey: idem.idempotencyKey,
            requestContext: getRequestContext(c),
          });
        return c.json(result);
      } catch (error) {
        return handleReconciliationError(c, error);
      }
    },
  );

  return app;
}
