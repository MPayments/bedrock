import {
  InvariantViolationError,
  type DomainErrorOptions,
} from "./domain-error";

export type InvariantOptions = DomainErrorOptions & {
  error?: Error;
};

export function invariant(
  statement: unknown,
  message = "Invariant violated",
  options: InvariantOptions = {},
): asserts statement {
  if (statement) return;

  if (options.error) {
    throw options.error;
  }

  throw new InvariantViolationError(message, {
    code: options.code,
    cause: options.cause,
    meta: options.meta,
  });
}
