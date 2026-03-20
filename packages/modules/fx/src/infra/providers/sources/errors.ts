import { ServiceError } from "@bedrock/shared/core/errors";

export class RateSourceSyncError extends ServiceError {
  name = "RateSourceSyncError";

  constructor(source: string, message: string, cause?: unknown) {
    super(`${source}: ${message}`, cause);
  }
}

export function getRootCauseMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;

  let current: unknown = error;
  while (current instanceof Error && current.cause != null) {
    current = current.cause;
  }

  if (current === error) return undefined;
  if (current instanceof Error) return current.message;
  if (typeof current === "string") return current;
  return String(current);
}
