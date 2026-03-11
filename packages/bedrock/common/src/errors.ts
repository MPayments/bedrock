import { z } from "zod";

export type BedrockErrorArgs = {
  message: string;
  code: string;
  status?: number;
  details?: unknown;
};

export type DomainErrorDescriptor<
  TCode extends string = string,
  TDetails extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
> = Readonly<{
  kind: "domain-error";
  code: TCode;
  details?: TDetails;
}>;

export type HttpErrorDescriptor<
  TCode extends string = string,
  TStatus extends number = number,
  TDetails extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
> = Readonly<{
  kind: "http-error";
  code: TCode;
  status: TStatus;
  description?: string;
  details?: TDetails;
}>;

export type ErrorDescriptor = DomainErrorDescriptor | HttpErrorDescriptor;

export type InferErrorDetails<TDescriptor extends ErrorDescriptor> =
  NonNullable<TDescriptor["details"]> extends z.ZodTypeAny
    ? z.output<NonNullable<TDescriptor["details"]>>
    : undefined;

export type DomainErrorInstance<
  TDescriptor extends DomainErrorDescriptor = DomainErrorDescriptor,
> = {
  kind: "domain-error";
  code: TDescriptor["code"];
  details: InferErrorDetails<TDescriptor>;
};

export type HttpErrorInstance<
  TDescriptor extends HttpErrorDescriptor = HttpErrorDescriptor,
> = {
  kind: "http-error";
  code: TDescriptor["code"];
  status: TDescriptor["status"];
  details: InferErrorDetails<TDescriptor>;
};

export type ErrorInstance<TDescriptor extends ErrorDescriptor> =
  TDescriptor extends DomainErrorDescriptor
    ? DomainErrorInstance<TDescriptor>
    : TDescriptor extends HttpErrorDescriptor
      ? HttpErrorInstance<TDescriptor>
      : never;

export type Ok<T> = {
  ok: true;
  value: T;
};

export type Err<E> = {
  ok: false;
  error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

export const ERROR_RESULT_MARKER = Symbol.for("@bedrock/error-result");

export type ErrorResult<E> = Readonly<{
  [ERROR_RESULT_MARKER]: true;
  error: E;
}>;

export class BedrockError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(args: BedrockErrorArgs) {
    super(args.message);
    this.name = "BedrockError";
    this.code = args.code;
    this.status = args.status;
    this.details = args.details;
  }
}

export function bedrockError(args: BedrockErrorArgs): BedrockError {
  return new BedrockError(args);
}

export function defineDomainError<
  TCode extends string,
  TDetails extends z.ZodTypeAny | undefined = undefined,
>(
  code: TCode,
  options: {
    details?: TDetails;
  } = {},
): DomainErrorDescriptor<TCode, TDetails> {
  validateErrorCode(code, "domain error");
  validateOptionalSchema(options.details, code);

  return Object.freeze({
    kind: "domain-error" as const,
    code,
    details: options.details,
  });
}

export function defineHttpError<
  TCode extends string,
  TStatus extends number,
  TDetails extends z.ZodTypeAny | undefined = undefined,
>(
  code: TCode,
  options: {
    status: TStatus;
    description?: string;
    details?: TDetails;
  },
): HttpErrorDescriptor<TCode, TStatus, TDetails> {
  validateErrorCode(code, "http error");
  validateHttpStatus(options.status, code);
  validateOptionalSchema(options.details, code);

  return Object.freeze({
    kind: "http-error" as const,
    code,
    status: options.status,
    description: options.description,
    details: options.details,
  });
}

export function error<TDescriptor extends ErrorDescriptor>(
  descriptor: TDescriptor,
  details?: InferErrorDetails<TDescriptor>,
): ErrorResult<ErrorInstance<TDescriptor>> {
  return Object.freeze({
    [ERROR_RESULT_MARKER]: true as const,
    error: createErrorInstance(descriptor, details),
  }) as ErrorResult<ErrorInstance<TDescriptor>>;
}

export function isBedrockError(value: unknown): value is BedrockError {
  return value instanceof BedrockError;
}

export function isErrorResult<E = unknown>(value: unknown): value is ErrorResult<E> {
  return (
    typeof value === "object" &&
    value !== null &&
    ERROR_RESULT_MARKER in value &&
    (value as ErrorResult<E>)[ERROR_RESULT_MARKER] === true
  );
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

export function matchResult<T, E, TOutput>(
  result: Result<T, E>,
  handlers: {
    ok(value: T): TOutput;
    err(error: E): TOutput;
  },
): TOutput {
  return result.ok ? handlers.ok(result.value) : handlers.err(result.error);
}

export function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }

  throw result.error;
}

export function bootError(message: string, details?: unknown): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_BOOT_ERROR",
    details,
  });
}

export function dependencyResolutionError(
  message: string,
  details?: unknown,
): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_DEPENDENCY_RESOLUTION_ERROR",
    details,
  });
}

export function validationError(
  message: string,
  details?: unknown,
): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_VALIDATION_ERROR",
    status: 400,
    details,
  });
}

export function scopeError(message: string, details?: unknown): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_SCOPE_ERROR",
    details,
  });
}

export function conflictError(message: string, details?: unknown): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_CONFLICT_ERROR",
    status: 409,
    details,
  });
}

export function notFoundError(message: string, details?: unknown): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_NOT_FOUND_ERROR",
    status: 404,
    details,
  });
}

export function adapterError(message: string, details?: unknown): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_ADAPTER_ERROR",
    details,
  });
}

export function routeContractError(): BedrockError {
  return bedrockError({
    message: "Route error contract violated.",
    code: "BEDROCK_HTTP_ROUTE_CONTRACT_ERROR",
    status: 500,
  });
}

export function actionContractError(
  message: string,
  details?: unknown,
): BedrockError {
  return bedrockError({
    message,
    code: "BEDROCK_ACTION_CONTRACT_ERROR",
    status: 500,
    details,
  });
}

function createErrorInstance<TDescriptor extends ErrorDescriptor>(
  descriptor: TDescriptor,
  details?: InferErrorDetails<TDescriptor>,
): ErrorInstance<TDescriptor> {
  if (descriptor.kind === "http-error") {
    return Object.freeze({
      kind: "http-error" as const,
      code: descriptor.code,
      status: descriptor.status,
      details,
    }) as ErrorInstance<TDescriptor>;
  }

  return Object.freeze({
    kind: "domain-error" as const,
    code: descriptor.code,
    details,
  }) as ErrorInstance<TDescriptor>;
}

function validateErrorCode(code: string, kind: string): void {
  if (typeof code !== "string" || code.trim().length === 0) {
    throw new Error(`Cannot define ${kind} with an empty code.`);
  }
}

function validateHttpStatus(status: number, code: string): void {
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new Error(
      `Cannot define http error "${code}" with invalid status ${String(status)}.`,
    );
  }
}

function validateOptionalSchema(
  schema: z.ZodTypeAny | undefined,
  code: string,
): void {
  if (schema !== undefined && !(schema instanceof z.ZodType)) {
    throw new Error(`Error descriptor "${code}" must use a Zod schema for details.`);
  }
}
