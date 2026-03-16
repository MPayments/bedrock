import { ServiceError } from "@bedrock/shared/core/errors";

export class RateSourceSyncError extends ServiceError {
  name = "RateSourceSyncError";

  constructor(source: string, message: string, cause?: unknown) {
    super(`${source}: ${message}`, cause);
  }
}
