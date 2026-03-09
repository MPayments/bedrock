import { OpenAPIHono, z } from "@hono/zod-openapi";

import { PaymentIntentInputSchema } from "@bedrock/payments";

import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { getRequestContext } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";
import { registerIdempotentMutationRoute } from "./internal/register-idempotent-mutation-route";

const CreatePaymentInputSchema = z.object({
  createIdempotencyKey: z.string().trim().min(1).max(255),
  input: z.unknown(),
});

const ListPaymentsQuerySchema = z.object({
  kind: z.enum(["intent", "resolution", "all"]).default("intent"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

type PaymentMutationAction =
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "cancel";

interface PaymentMutationConfig {
  path: string;
  permission: PaymentMutationAction;
  action: PaymentMutationAction;
}
export function paymentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  function registerPaymentMutationAction(config: PaymentMutationConfig) {
    registerIdempotentMutationRoute({
      app,
      path: config.path,
      permission: { payments: [config.permission] },
      handle: async ({ c, actorUserId, idempotencyKey, requestContext }) => {
        const documentId = c.req.param("id");
        if (!documentId) {
          throw new Error("Payment id is required");
        }

        return ctx.paymentsService.transitionIntent({
          action: config.action,
          documentId,
          actorUserId,
          idempotencyKey,
          requestContext,
        });
      },
      jsonOptions: { normalizeMoney: true },
      handleError: handleRouteError,
    });
  }

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
      return jsonOk(c, result, 200, { normalizeMoney: true });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post("/", requirePermission({ payments: ["create"] }), async (c) => {
    try {
      const body = CreatePaymentInputSchema.parse(await c.req.json());
      const result = await ctx.paymentsService.createDraft({
        payload: PaymentIntentInputSchema.parse(body.input),
        createIdempotencyKey: body.createIdempotencyKey,
        actorUserId: c.get("user")!.id,
        requestContext: getRequestContext(c),
      });
      return jsonOk(c, result, 201, { normalizeMoney: true });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.get("/:id", requirePermission({ payments: ["get"] }), async (c) => {
    try {
      const { id } = c.req.param();
      const result = await ctx.paymentsService.get(id);
      return jsonOk(c, result, 200, { normalizeMoney: true });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.get(
    "/:id/details",
    requirePermission({ payments: ["get"] }),
    async (c) => {
      try {
        const { id } = c.req.param();
        const result = await ctx.paymentsService.getDetails(id, c.get("user")!.id);
        return jsonOk(c, result, 200, { normalizeMoney: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  registerPaymentMutationAction({
    path: "/:id/submit",
    permission: "submit",
    action: "submit",
  });
  registerPaymentMutationAction({
    path: "/:id/approve",
    permission: "approve",
    action: "approve",
  });
  registerPaymentMutationAction({
    path: "/:id/reject",
    permission: "reject",
    action: "reject",
  });
  registerPaymentMutationAction({
    path: "/:id/post",
    permission: "post",
    action: "post",
  });
  registerPaymentMutationAction({
    path: "/:id/cancel",
    permission: "cancel",
    action: "cancel",
  });

  return app;
}
