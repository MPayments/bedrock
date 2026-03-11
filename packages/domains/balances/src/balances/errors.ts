import {
  InvalidStateError,
  NotFoundError,
  ServiceError,
  ValidationError,
} from "@multihansa/common/errors";

export class BalancesError extends ServiceError {}

export class InsufficientAvailableBalanceError extends ValidationError {
  constructor(
    public readonly available: bigint,
    public readonly requested: bigint,
  ) {
    super(
      `Insufficient available balance: requested ${requested}, available ${available}`,
    );
  }
}

export class BalanceHoldNotFoundError extends NotFoundError {
  constructor(holdRef: string) {
    super("Balance hold", holdRef);
  }
}

export class BalanceHoldConflictError extends ValidationError {
  constructor(holdRef: string) {
    super(`Balance hold already exists with a different amount: ${holdRef}`);
  }
}

export class BalanceHoldStateError extends InvalidStateError {
  constructor(holdRef: string, state: string, action: string) {
    super(`Cannot ${action} balance hold ${holdRef} while in state ${state}`);
  }
}
