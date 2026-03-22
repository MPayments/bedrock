import { ServiceError } from "@bedrock/shared/core/errors";

export class LedgerError extends ServiceError {
  name = "LedgerError";
}

export * from "./balances/errors";

export class IdempotencyConflictError extends LedgerError {
  name = "IdempotencyConflictError";
}

export class TigerBeetleBatchError extends LedgerError {
  name = "TigerBeetleBatchError";
  constructor(
    msg: string,
    public readonly operation: "createAccounts" | "createTransfers",
    public readonly details: { index: number; code: number; name: string }[],
  ) {
    super(msg);
  }
}

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const err = error as any;
  const message = err?.message?.toLowerCase() || "";
  const code = err?.code?.toUpperCase() || "";
  const name = err?.name || "";

  const retryableCodes = [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EAI_AGAIN",
    "ENOTFOUND",
  ];

  if (retryableCodes.includes(code)) {
    return true;
  }

  if (
    message.includes("connection") &&
    (message.includes("refused") ||
      message.includes("timeout") ||
      message.includes("lost"))
  ) {
    return true;
  }

  if (
    err instanceof IdempotencyConflictError ||
    err instanceof TigerBeetleBatchError ||
    err instanceof LedgerError
  ) {
    return false;
  }

  if (
    name.includes("Validation") ||
    message.includes("invalid") ||
    message.includes("must be") ||
    message.includes("required") ||
    message.includes("conflict")
  ) {
    return false;
  }

  return true;
}
