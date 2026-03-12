import { OpenAPIHono, z } from "@hono/zod-openapi";

import { BalanceSubjectSchema } from "@bedrock/core/balances";

import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withEtag } from "../middleware/etag";
import { requirePermission } from "../middleware/permission";
import {
  handleBalancesError,
  toBalanceSnapshotDto,
  toMutationResultDto,
} from "./internal/balances-route-helpers";
import { registerIdempotentMutationRoute } from "./internal/register-idempotent-mutation-route";

const BalanceSubjectParamsSchema = z.object({
  bookId: z.uuid(),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  currency: z.string().min(1),
});

const ReserveBalanceBodySchema = z.object({
  subject: BalanceSubjectSchema,
  amount: z.string().min(1),
  holdRef: z.string().min(1),
  reason: z.string().optional(),
});

const HoldActionBodySchema = z.object({
  subject: BalanceSubjectSchema,
  holdRef: z.string().min(1),
  reason: z.string().optional(),
});

export function balancesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.get(
    "/:bookId/:subjectType/:subjectId/:currency",
    requirePermission({ balances: ["get"] }),
    withEtag((b) => b.version as number | undefined),
    async (c) => {
      try {
        const subject = BalanceSubjectParamsSchema.parse(c.req.param());
        const result = await ctx.balancesService.getBalance(subject);
        return jsonOk(c, toBalanceSnapshotDto(result));
      } catch (error) {
        return handleBalancesError(c, error);
      }
    },
  );

  registerIdempotentMutationRoute({
    app,
    path: "/reserve",
    permission: { balances: ["reserve"] },
    parseBody: async (c) => ReserveBalanceBodySchema.parse(await c.req.json()),
    handle: async ({ body, actorUserId, idempotencyKey, requestContext }) =>
      ctx.balancesService.reserve({
        subject: body.subject,
        amount: body.amount,
        holdRef: body.holdRef,
        reason: body.reason,
        actorId: actorUserId,
        idempotencyKey,
        requestContext,
      }),
    respond: (c, result) => jsonOk(c, toMutationResultDto(result)),
    handleError: handleBalancesError,
  });

  registerIdempotentMutationRoute({
    app,
    path: "/release",
    permission: { balances: ["release"] },
    parseBody: async (c) => HoldActionBodySchema.parse(await c.req.json()),
    handle: async ({ body, actorUserId, idempotencyKey, requestContext }) =>
      ctx.balancesService.release({
        subject: body.subject,
        holdRef: body.holdRef,
        reason: body.reason,
        actorId: actorUserId,
        idempotencyKey,
        requestContext,
      }),
    respond: (c, result) => jsonOk(c, toMutationResultDto(result)),
    handleError: handleBalancesError,
  });

  registerIdempotentMutationRoute({
    app,
    path: "/consume",
    permission: { balances: ["consume"] },
    parseBody: async (c) => HoldActionBodySchema.parse(await c.req.json()),
    handle: async ({ body, actorUserId, idempotencyKey, requestContext }) =>
      ctx.balancesService.consume({
        subject: body.subject,
        holdRef: body.holdRef,
        reason: body.reason,
        actorId: actorUserId,
        idempotencyKey,
        requestContext,
      }),
    respond: (c, result) => jsonOk(c, toMutationResultDto(result)),
    handleError: handleBalancesError,
  });

  return app;
}
