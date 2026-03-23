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
