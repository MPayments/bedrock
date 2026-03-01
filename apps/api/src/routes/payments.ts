import { OpenAPIHono, z } from "@hono/zod-openapi";

import {
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentValidationError,
} from "@bedrock/documents";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/idempotency";
import { InvalidStateError, PermissionError } from "@bedrock/kernel/errors";
import { PaymentIntentPayloadSchema } from "@bedrock/payments";

import { toJsonSafe } from "../common/json";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  requireIdempotencyKey,
} from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

const CreatePaymentInputSchema = z.object({
  createIdempotencyKey: z.string().trim().min(1).max(255),
  input: z.unknown(),
});

const ListPaymentsQuerySchema = z.object({
  kind: z.enum(["intent", "resolution", "all"]).default("intent"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function resolveErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isZodErrorLike(
  error: unknown,
): error is { flatten: () => unknown; issues: unknown[] } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown[] }).issues) &&
      "flatten" in error &&
      typeof (error as { flatten?: unknown }).flatten === "function",
  );
}

function handlePaymentsError(c: any, error: unknown) {
  if (isZodErrorLike(error)) {
    return c.json(
      {
        error: "Validation error",
        details: error.flatten(),
      },
      400,
    );
  }
  if (error instanceof DocumentNotFoundError) {
    return c.json({ error: resolveErrorMessage(error) }, 404);
  }
  if (
    error instanceof PermissionError ||
    error instanceof DocumentPolicyDeniedError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 403);
  }
  if (
    error instanceof DocumentValidationError ||
    error instanceof DocumentGraphError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 400);
  }
  if (
    error instanceof InvalidStateError ||
    error instanceof DocumentPostingNotRequiredError ||
    error instanceof ActionReceiptConflictError ||
    error instanceof ActionReceiptStoredError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 409);
  }
  throw error;
}

export function paymentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.get("/", requirePermission({ payments: ["list"] }), async (c) => {
    try {
      const query = ListPaymentsQuerySchema.parse(
        Object.fromEntries(new URL(c.req.url).searchParams.entries()),
      );
      const result = await ctx.paymentsService.list({
        kind: query.kind,
        limit: query.limit,
        offset: query.offset,
      });
      return c.json(toJsonSafe(result));
    } catch (error) {
      return handlePaymentsError(c, error);
    }
  });

  app.post("/", requirePermission({ payments: ["create"] }), async (c) => {
    try {
      const body = CreatePaymentInputSchema.parse(await c.req.json());
      const result = await ctx.paymentsService.createDraft({
        payload: PaymentIntentPayloadSchema.parse(body.input),
        createIdempotencyKey: body.createIdempotencyKey,
        actorUserId: c.get("user")!.id,
        requestContext: getRequestContext(c),
      });
      return c.json(toJsonSafe(result), 201);
    } catch (error) {
      return handlePaymentsError(c, error);
    }
  });

  app.get("/:id", requirePermission({ payments: ["get"] }), async (c) => {
    try {
      const { id } = c.req.param();
      const result = await ctx.paymentsService.get(id);
      return c.json(toJsonSafe(result));
    } catch (error) {
      return handlePaymentsError(c, error);
    }
  });

  app.get(
    "/:id/details",
    requirePermission({ payments: ["get"] }),
    async (c) => {
      try {
        const { id } = c.req.param();
        const result = await ctx.paymentsService.getDetails(id, c.get("user")!.id);
        return c.json(toJsonSafe(result));
      } catch (error) {
        return handlePaymentsError(c, error);
      }
    },
  );

  app.post(
    "/:id/submit",
    requirePermission({ payments: ["submit"] }),
    async (c) => {
      try {
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const { id } = c.req.param();
        const result = await ctx.paymentsService.submit({
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toJsonSafe(result));
      } catch (error) {
        return handlePaymentsError(c, error);
      }
    },
  );

  app.post(
    "/:id/approve",
    requirePermission({ payments: ["approve"] }),
    async (c) => {
      try {
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const { id } = c.req.param();
        const result = await ctx.paymentsService.approve({
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toJsonSafe(result));
      } catch (error) {
        return handlePaymentsError(c, error);
      }
    },
  );

  app.post(
    "/:id/reject",
    requirePermission({ payments: ["reject"] }),
    async (c) => {
      try {
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const { id } = c.req.param();
        const result = await ctx.paymentsService.reject({
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toJsonSafe(result));
      } catch (error) {
        return handlePaymentsError(c, error);
      }
    },
  );

  app.post("/:id/post", requirePermission({ payments: ["post"] }), async (c) => {
    try {
      const idem = requireIdempotencyKey(c);
      if (!idem.ok) return idem.response;
      const { id } = c.req.param();
      const result = await ctx.paymentsService.post({
        documentId: id,
        actorUserId: c.get("user")!.id,
        idempotencyKey: idem.idempotencyKey,
        requestContext: getRequestContext(c),
      });
      return c.json(toJsonSafe(result));
    } catch (error) {
      return handlePaymentsError(c, error);
    }
  });

  app.post(
    "/:id/cancel",
    requirePermission({ payments: ["cancel"] }),
    async (c) => {
      try {
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const { id } = c.req.param();
        const result = await ctx.paymentsService.cancel({
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toJsonSafe(result));
      } catch (error) {
        return handlePaymentsError(c, error);
      }
    },
  );

  return app;
}
