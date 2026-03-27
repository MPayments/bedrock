import { ServiceError } from "@bedrock/shared/core/errors";

export { ValidationError, NotFoundError } from "@bedrock/shared/core/errors";

export class TreasuryError extends ServiceError {}

export class TreasuryConflictError extends TreasuryError {
  name = "TreasuryConflictError";
}

export class TreasuryEntityNotFoundError extends TreasuryError {
  name = "TreasuryEntityNotFoundError";

  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
  }
}

export class TreasuryOperationIdempotencyConflictError extends TreasuryConflictError {
  name = "TreasuryOperationIdempotencyConflictError";

  constructor(idempotencyKey: string) {
    super(`Treasury operation idempotency key already exists: ${idempotencyKey}`);
  }
}

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
