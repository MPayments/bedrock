import {
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
  InsufficientAvailableBalanceError,
} from "@bedrock/balances";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/idempotency";
import { ValidationError } from "@bedrock/kernel/errors";
import { minorToAmountString } from "@bedrock/kernel/money";

export function toBalanceSnapshotDto(input: {
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

export function toMutationResultDto(input: {
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

export function handleBalancesError(
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
