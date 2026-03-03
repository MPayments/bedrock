import { OpenAPIHono, z } from "@hono/zod-openapi";

import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
  BalanceSubjectSchema,
  InsufficientAvailableBalanceError,
} from "@bedrock/core/balances";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/core/idempotency";
import { ValidationError } from "@bedrock/kernel/errors";

import { minorToAmountString } from "../common/amount";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withEtag } from "../middleware/etag";
import {
  getRequestContext,
  withRequiredIdempotency,
} from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

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

function toBalanceSnapshotDto(input: {
  bookId: string;
  subjectType: string;
  subjectId: string;
  currency: string;
  ledgerBalance: bigint;
  available: bigint;
  reserved: bigint;
  pending: bigint;
  version: number;
}) {
  return {
    ...input,
    ledgerBalance: minorToAmountString(input.ledgerBalance, {
      currency: input.currency,
    }),
    available: minorToAmountString(input.available, {
      currency: input.currency,
    }),
    reserved: minorToAmountString(input.reserved, {
      currency: input.currency,
    }),
    pending: minorToAmountString(input.pending, {
      currency: input.currency,
    }),
  };
}

function toMutationResultDto(input: {
  balance: {
    bookId: string;
    subjectType: string;
    subjectId: string;
    currency: string;
    ledgerBalance: bigint;
    available: bigint;
    reserved: bigint;
    pending: bigint;
    version: number;
  };
  hold: {
    id: string;
    holdRef: string;
    amountMinor: bigint;
    state: string;
    reason: string | null;
    createdAt: Date;
    releasedAt: Date | null;
    consumedAt: Date | null;
  } | null;
}) {
  return {
    balance: toBalanceSnapshotDto(input.balance),
    hold: input.hold
      ? (() => {
          const { amountMinor, ...restHold } = input.hold;
          return {
            ...restHold,
            amount: minorToAmountString(amountMinor, {
              currency: input.balance.currency,
            }),
            createdAt: input.hold.createdAt.toISOString(),
            releasedAt: input.hold.releasedAt?.toISOString() ?? null,
            consumedAt: input.hold.consumedAt?.toISOString() ?? null,
          };
        })()
      : null,
  };
}

function handleBalancesError(
  c: { json: (body: unknown, status?: number) => Response },
  error: unknown,
) {
  if (error instanceof BalanceHoldNotFoundError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof ValidationError) {
    return c.json({ error: error.message }, 400);
  }
  if (
    error instanceof InsufficientAvailableBalanceError ||
    error instanceof BalanceHoldStateError ||
    error instanceof ActionReceiptConflictError ||
    error instanceof ActionReceiptStoredError
  ) {
    return c.json({ error: error.message }, 409);
  }

  throw error;
}

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

  app.post(
    "/reserve",
    requirePermission({ balances: ["reserve"] }),
    async (c) => {
      try {
        const body = ReserveBalanceBodySchema.parse(await c.req.json());
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.balancesService.reserve({
            subject: body.subject,
            amount: body.amount,
            holdRef: body.holdRef,
            reason: body.reason,
            actorId: c.get("user")!.id,
            idempotencyKey,
            requestContext: getRequestContext(c),
          }),
        );
        if (result instanceof Response) return result;
        return jsonOk(c, toMutationResultDto(result));
      } catch (error) {
        return handleBalancesError(c, error);
      }
    },
  );

  app.post(
    "/release",
    requirePermission({ balances: ["release"] }),
    async (c) => {
      try {
        const body = HoldActionBodySchema.parse(await c.req.json());
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.balancesService.release({
            subject: body.subject,
            holdRef: body.holdRef,
            reason: body.reason,
            actorId: c.get("user")!.id,
            idempotencyKey,
            requestContext: getRequestContext(c),
          }),
        );
        if (result instanceof Response) return result;
        return jsonOk(c, toMutationResultDto(result));
      } catch (error) {
        return handleBalancesError(c, error);
      }
    },
  );

  app.post(
    "/consume",
    requirePermission({ balances: ["consume"] }),
    async (c) => {
      try {
        const body = HoldActionBodySchema.parse(await c.req.json());
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.balancesService.consume({
            subject: body.subject,
            holdRef: body.holdRef,
            reason: body.reason,
            actorId: c.get("user")!.id,
            idempotencyKey,
            requestContext: getRequestContext(c),
          }),
        );
        if (result instanceof Response) return result;
        return jsonOk(c, toMutationResultDto(result));
      } catch (error) {
        return handleBalancesError(c, error);
      }
    },
  );

  return app;
}
