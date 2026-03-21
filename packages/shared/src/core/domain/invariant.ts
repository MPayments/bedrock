import {
  InvariantViolationError,
  type DomainErrorOptions,
} from "./domain-error";

export type InvariantOptions = DomainErrorOptions & {
  error?: Error;
};

export function invariant(
  statement: unknown,
  message?: string,
  options?: InvariantOptions,
): asserts statement;
export function invariant(
  statement: unknown,
  code: string,
  message: string,
): asserts statement;
export function invariant(
  statement: unknown,
  messageOrCode = "Invariant violated",
  messageOrOptions: string | InvariantOptions = {},
): asserts statement {
  if (statement) return;

  if (typeof messageOrOptions === "string") {
    throw new InvariantViolationError(messageOrOptions, {
      code: messageOrCode,
    });
  }

  const options = messageOrOptions;

  if (options.error) {
    throw options.error;
  }

  throw new InvariantViolationError(messageOrCode, {
    code: options.code,
    cause: options.cause,
    meta: options.meta,
  });
}
