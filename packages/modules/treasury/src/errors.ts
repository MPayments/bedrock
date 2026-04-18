import { ServiceError } from "@bedrock/shared/core/errors";

export { ValidationError, NotFoundError } from "@bedrock/shared/core/errors";

export class TreasuryError extends ServiceError {}

export class RateNotFoundError extends TreasuryError {
  name = "RateNotFoundError";
}

export class QuoteExpiredError extends TreasuryError {
  name = "QuoteExpiredError";
}

export class QuoteIdempotencyConflictError extends TreasuryError {
  name = "QuoteIdempotencyConflictError";

  constructor(idempotencyKey: string) {
    super(`Quote idempotency key already exists with different input: ${idempotencyKey}`);
  }
}

export class RateSourceSyncError extends TreasuryError {
  name = "RateSourceSyncError";

  constructor(source: string, message: string, cause?: unknown) {
    super(`${source}: ${message}`, cause);
  }
}

export class RateSourceStaleError extends TreasuryError {
  name = "RateSourceStaleError";

  constructor(source: string, cause?: unknown) {
    super(`Rate source is stale and refresh failed: ${source}`, cause);
  }
}

export class TreasuryOperationNotFoundError extends TreasuryError {
  name = "TreasuryOperationNotFoundError";

  constructor(operationId: string) {
    super(`Treasury operation not found: ${operationId}`);
  }
}

export class TreasuryInstructionNotFoundError extends TreasuryError {
  name = "TreasuryInstructionNotFoundError";

  constructor(ref: string) {
    super(`Treasury instruction not found: ${ref}`);
  }
}

export class TreasuryInstructionStateError extends TreasuryError {
  name = "TreasuryInstructionStateError";

  constructor(instructionId: string, state: string, action: string) {
    super(
      `Treasury instruction ${instructionId} in state ${state} cannot ${action}`,
    );
  }
}

export class TreasuryInstructionNotActionableError extends TreasuryError {
  name = "TreasuryInstructionNotActionableError";

  constructor(instructionId: string, state: string) {
    super(
      `Treasury instruction ${instructionId} in state ${state} is not the latest actionable attempt`,
    );
  }
}
