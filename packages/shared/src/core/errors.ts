export class ServiceError extends Error {
  public readonly cause?: unknown;

  constructor(message = "", cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
  }
}

export class ValidationError extends ServiceError {}

export class InvalidStateError extends ServiceError {}

export class PermissionError extends ServiceError {}

export class NotFoundError extends ServiceError {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string
  ) {
    super(`${entityType} not found: ${entityId}`);
  }
}

export class ConflictError extends ServiceError {
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class AmountMismatchError extends ValidationError {
  constructor(
    public readonly field: string,
    public readonly expected: bigint,
    public readonly actual: bigint
  ) {
    super(`${field} mismatch: expected ${expected}, got ${actual}`);
  }
}

export class CurrencyMismatchError extends ValidationError {
  constructor(
    public readonly field: string,
    public readonly expected: string,
    public readonly actual: string
  ) {
    super(`${field} currency mismatch: expected ${expected}, got ${actual}`);
  }
}
