// domain-error.ts
export interface DomainErrorOptions {
  code?: string;
  cause?: unknown;
  meta?: Readonly<Record<string, unknown>>;
}

export class DomainError extends Error {
  readonly code: string;
  readonly meta?: Readonly<Record<string, unknown>> | undefined;

  constructor(message: string, options: DomainErrorOptions = {}) {
    super(
      message,
      options.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = new.target.name;
    this.code = options.code ?? "domain_error";
    this.meta = options.meta;
  }
}

export class InvariantViolationError extends DomainError {
  constructor(message: string, options: DomainErrorOptions = {}) {
    super(message, {
      code: options.code ?? "invariant_violation",
      cause: options.cause,
      meta: options.meta,
    });
  }
}
