import type { Context } from "hono";
import { z } from "zod";

import {
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentSystemOnlyTypeError,
  DocumentValidationError,
} from "@bedrock/documents";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/platform/idempotency-postgres";
import {
  InvalidStateError,
  NotFoundError,
  PermissionError,
  ValidationError,
} from "@bedrock/shared/core/errors";

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Shared route-level error handler.
 *
 * Handles known domain errors with appropriate HTTP status codes.
 * **Rethrows** unknown errors so the global handler in app.ts
 * returns 500 without leaking internal details.
 */
export function handleRouteError(c: Context, error: unknown): any {
  if (error instanceof z.ZodError) {
    return c.json(
      { error: "Validation error", details: z.treeifyError(error) },
      400,
    );
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
    error instanceof DocumentSystemOnlyTypeError ||
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
