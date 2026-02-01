export class PaymentsError extends Error {
  name = "PaymentsError";
}

export class InvalidStateError extends PaymentsError {
  name = "InvalidStateError";
}

export class NotFoundError extends PaymentsError {
  name = "NotFoundError";
  constructor(public readonly entityType: string, public readonly entityId: string) {
    super(`${entityType} not found: ${entityId}`);
  }
}

export class ValidationError extends PaymentsError {
  name = "ValidationError";
}

export class AmountMismatchError extends ValidationError {
  name = "AmountMismatchError";
  constructor(
    public readonly field: string,
    public readonly expected: bigint,
    public readonly actual: bigint
  ) {
    super(`${field} mismatch: expected ${expected}, got ${actual}`);
  }
}

export class CurrencyMismatchError extends ValidationError {
  name = "CurrencyMismatchError";
  constructor(
    public readonly field: string,
    public readonly expected: string,
    public readonly actual: string
  ) {
    super(`${field} currency mismatch: expected ${expected}, got ${actual}`);
  }
}
