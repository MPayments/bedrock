import type { Context } from "hono";

import {
  InvalidStateError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from "@bedrock/kernel/errors";
import {
  ConnectorIntentTerminalError,
  ConnectorMaxAttemptsExceededError,
} from "@bedrock/core/connectors";
import {
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentValidationError,
} from "@bedrock/core/documents";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/core/idempotency";

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isZodErrorLike(
  error: unknown,
): error is { flatten: () => unknown; issues: unknown[] } {
  return Boolean(
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown[] }).issues) &&
    "flatten" in error &&
    typeof (error as { flatten?: unknown }).flatten === "function",
  );
}

/**
 * Shared route-level error handler.
 *
 * Handles known domain errors with appropriate HTTP status codes.
 * **Rethrows** unknown errors so the global handler in app.ts
 * returns 500 without leaking internal details.
 */
export function handleRouteError(c: Context, error: unknown): Response {
  if (isZodErrorLike(error)) {
    return c.json({ error: "Validation error", details: error.flatten() }, 400);
  }

  if (
    error instanceof DocumentNotFoundError ||
    error instanceof NotFoundError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 404);
  }

  if (
    error instanceof PermissionError ||
    error instanceof DocumentPolicyDeniedError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 403);
  }

  if (
    error instanceof DocumentValidationError ||
    error instanceof DocumentGraphError ||
    error instanceof ValidationError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 400);
  }

  if (
    error instanceof ConnectorIntentTerminalError ||
    error instanceof ConnectorMaxAttemptsExceededError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 409);
  }

  if (
    error instanceof InvalidStateError ||
    error instanceof DocumentPostingNotRequiredError ||
    error instanceof ActionReceiptConflictError ||
    error instanceof ActionReceiptStoredError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 409);
  }

  // Unknown error -- rethrow to let global handler return 500
  throw error;
}
