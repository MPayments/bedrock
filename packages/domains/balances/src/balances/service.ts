import { defineService, error, type Logger as BedrockLogger } from "@bedrock/core";
import {
  BalanceHoldConflictError,
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
  InsufficientAvailableBalanceError,
} from "./errors";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@multihansa/common/operations";
import { ValidationError } from "@multihansa/common/errors";
import { z } from "zod";

import {
  BadRequestDomainError,
  DbToken,
  ConflictDomainError,
  MissingIdempotencyKeyDomainError,
  NotFoundDomainError,
  RequestContextToken,
  adaptBedrockLogger,
  minorToAmountString,
  requireActorUserId,
  requireIdempotencyKey,
} from "@multihansa/common/bedrock";
import { AuthContextToken } from "@bedrock/security";
import { BalanceSubjectSchema } from "./validation";

import { createBalancesServiceContext } from "./context";
import {
  BalanceMutationResultSchema,
  BalanceSnapshotSchema,
} from "./schemas";
import {
  consumeBalance,
  getBalance,
  releaseBalance,
  reserveBalance,
} from "./runtime";

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
      ? {
          id: input.hold.id,
          holdRef: input.hold.holdRef,
          amount: minorToAmountString(input.hold.amountMinor, {
            currency: input.balance.currency,
          }),
          state: input.hold.state,
          reason: input.hold.reason,
          createdAt: input.hold.createdAt.toISOString(),
          releasedAt: input.hold.releasedAt?.toISOString() ?? null,
          consumedAt: input.hold.consumedAt?.toISOString() ?? null,
        }
      : null,
  };
}

function toDomainFailure(cause: unknown) {
  if (cause instanceof BalanceHoldNotFoundError) {
    return error(NotFoundDomainError, { message: cause.message });
  }

  if (cause instanceof ValidationError) {
    return error(BadRequestDomainError, { message: cause.message });
  }

  if (
    cause instanceof BalanceHoldConflictError ||
    cause instanceof InsufficientAvailableBalanceError ||
    cause instanceof BalanceHoldStateError ||
    cause instanceof ActionReceiptConflictError ||
    cause instanceof ActionReceiptStoredError
  ) {
    return error(ConflictDomainError, { message: cause.message });
  }

  throw cause;
}

function createBalancesContext(ctx: {
  db: Parameters<typeof createBalancesServiceContext>[0]["db"];
  logger: BedrockLogger;
}) {
  return createBalancesServiceContext({
    db: ctx.db,
    logger: adaptBedrockLogger(ctx.logger),
  });
}

export const balancesService = defineService("balances", {
  deps: {
    auth: AuthContextToken,
    db: DbToken,
    requestContext: RequestContextToken,
  },
  ctx: ({ auth, db, requestContext }) => ({
    auth,
    db,
    requestContext,
  }),
  actions: ({ action }) => ({
    get: action({
      input: BalanceSubjectParamsSchema,
      output: BalanceSnapshotSchema,
      handler: async ({ ctx, input }) =>
        toBalanceSnapshotDto(
          await getBalance(createBalancesContext(ctx), input),
        ),
    }),
    reserve: action({
      input: ReserveBalanceBodySchema,
      output: BalanceMutationResultSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        MissingIdempotencyKeyDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        const idempotencyKey = requireIdempotencyKey(ctx.requestContext);
        if (typeof idempotencyKey !== "string") {
          return idempotencyKey;
        }

        try {
          return toMutationResultDto(
            await reserveBalance(createBalancesContext(ctx), {
              ...input,
              actorId: requireActorUserId(ctx.auth),
              idempotencyKey,
              requestContext: ctx.requestContext,
            }),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    release: action({
      input: HoldActionBodySchema,
      output: BalanceMutationResultSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        MissingIdempotencyKeyDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        const idempotencyKey = requireIdempotencyKey(ctx.requestContext);
        if (typeof idempotencyKey !== "string") {
          return idempotencyKey;
        }

        try {
          return toMutationResultDto(
            await releaseBalance(createBalancesContext(ctx), {
              ...input,
              actorId: requireActorUserId(ctx.auth),
              idempotencyKey,
              requestContext: ctx.requestContext,
            }),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
    consume: action({
      input: HoldActionBodySchema,
      output: BalanceMutationResultSchema,
      errors: [
        BadRequestDomainError,
        ConflictDomainError,
        MissingIdempotencyKeyDomainError,
        NotFoundDomainError,
      ],
      handler: async ({ ctx, input }) => {
        const idempotencyKey = requireIdempotencyKey(ctx.requestContext);
        if (typeof idempotencyKey !== "string") {
          return idempotencyKey;
        }

        try {
          return toMutationResultDto(
            await consumeBalance(createBalancesContext(ctx), {
              ...input,
              actorId: requireActorUserId(ctx.auth),
              idempotencyKey,
              requestContext: ctx.requestContext,
            }),
          );
        } catch (cause) {
          return toDomainFailure(cause);
        }
      },
    }),
  }),
});
