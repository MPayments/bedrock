import { OpenAPIHono, z } from "@hono/zod-openapi";

import { ValidationError } from "@bedrock/foundation/kernel/errors";
import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
  BalanceSubjectSchema,
  InsufficientAvailableBalanceError,
} from "@bedrock/platform/balances";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/platform/idempotency";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withEtag } from "../middleware/etag";
import {
  getRequestContext,
  requireIdempotencyKey,
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
  amountMinor: z.string().min(1),
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
    ledgerBalance: input.ledgerBalance.toString(),
    available: input.available.toString(),
    reserved: input.reserved.toString(),
    pending: input.pending.toString(),
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
      ? {
          ...input.hold,
          amountMinor: input.hold.amountMinor.toString(),
          createdAt: input.hold.createdAt.toISOString(),
          releasedAt: input.hold.releasedAt?.toISOString() ?? null,
          consumedAt: input.hold.consumedAt?.toISOString() ?? null,
        }
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
        return c.json(toBalanceSnapshotDto(result));
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
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const body = ReserveBalanceBodySchema.parse(await c.req.json());
        const result = await ctx.balancesService.reserve({
          subject: body.subject,
          amountMinor: BigInt(body.amountMinor),
          holdRef: body.holdRef,
          reason: body.reason,
          actorId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toMutationResultDto(result));
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
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const body = HoldActionBodySchema.parse(await c.req.json());
        const result = await ctx.balancesService.release({
          subject: body.subject,
          holdRef: body.holdRef,
          reason: body.reason,
          actorId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toMutationResultDto(result));
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
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const body = HoldActionBodySchema.parse(await c.req.json());
        const result = await ctx.balancesService.consume({
          subject: body.subject,
          holdRef: body.holdRef,
          reason: body.reason,
          actorId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toMutationResultDto(result));
      } catch (error) {
        return handleBalancesError(c, error);
      }
    },
  );

  return app;
}
