import { ServiceError } from "@bedrock/core/errors";

export class IdempotencyError extends ServiceError {}

export class ActionReceiptConflictError extends IdempotencyError {
  constructor(
    public readonly scope: string,
    public readonly idempotencyKey: string,
  ) {
    super(`Idempotency conflict for ${scope}:${idempotencyKey}`);
  }
}

export class ActionReceiptStoredError extends IdempotencyError {
  constructor(
    public readonly scope: string,
    public readonly idempotencyKey: string,
    public readonly storedError: Record<string, unknown> | null,
  ) {
    super(
      typeof storedError?.message === "string"
        ? storedError.message
        : `Stored idempotent action failed for ${scope}:${idempotencyKey}`,
    );
  }
}
