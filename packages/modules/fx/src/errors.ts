import { ServiceError } from "@bedrock/core/errors";

export { ValidationError, NotFoundError } from "@bedrock/core/errors";

export class FxError extends ServiceError {}

export class RateNotFoundError extends FxError {
  name = "RateNotFoundError";
}

export class QuoteExpiredError extends FxError {
  name = "QuoteExpiredError";
}

export class RateSourceSyncError extends FxError {
  name = "RateSourceSyncError";

  constructor(source: string, message: string, cause?: unknown) {
    super(`${source}: ${message}`, cause);
  }
}

export class RateSourceStaleError extends FxError {
  name = "RateSourceStaleError";

  constructor(source: string, cause?: unknown) {
    super(`Rate source is stale and refresh failed: ${source}`, cause);
  }
}
