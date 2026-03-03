import { OpenAPIHono, z } from "@hono/zod-openapi";

import { PaymentIntentInputSchema } from "@bedrock/application/payments";

import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  withRequiredIdempotency,
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

type PaymentActionContext = Parameters<typeof handleRouteError>[0];

type PaymentMutationInput = {
  documentId: string;
  actorUserId: string;
  idempotencyKey: string;
  requestContext: ReturnType<typeof getRequestContext>;
};

type PaymentMutationMethod = (input: PaymentMutationInput) => Promise<unknown>;

export function paymentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  async function runPaymentAction(
    c: PaymentActionContext,
    serviceMethod: PaymentMutationMethod,
  ) {
    try {
      const id = c.req.param("id");
      const result = await withRequiredIdempotency(c, (idempotencyKey) =>
        serviceMethod({
          documentId: id,
          actorUserId: (c.get("user") as { id: string }).id,
          idempotencyKey,
          requestContext: getRequestContext(c),
        }),
      );
      if (result instanceof Response) {
        return result;
      }

      return jsonOk(c, result, 200, { normalizeMoney: true });
    } catch (error) {
      return handleRouteError(c, error);
    }
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

  app.post(
    "/:id/submit",
    requirePermission({ payments: ["submit"] }),
    async (c) => runPaymentAction(c, ctx.paymentsService.submit),
  );

  app.post(
    "/:id/approve",
    requirePermission({ payments: ["approve"] }),
    async (c) => runPaymentAction(c, ctx.paymentsService.approve),
  );

  app.post(
    "/:id/reject",
    requirePermission({ payments: ["reject"] }),
    async (c) => runPaymentAction(c, ctx.paymentsService.reject),
  );

  app.post(
    "/:id/post",
    requirePermission({ payments: ["post"] }),
    async (c) => runPaymentAction(c, ctx.paymentsService.post),
  );

  app.post(
    "/:id/cancel",
    requirePermission({ payments: ["cancel"] }),
    async (c) => runPaymentAction(c, ctx.paymentsService.cancel),
  );

  return app;
}
