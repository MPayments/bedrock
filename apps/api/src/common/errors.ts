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
import {
  RateNotFoundError,
  RateSourceStaleError,
  RateSourceSyncError,
} from "@bedrock/treasury";

function resolveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatZodIssuePath(path: PropertyKey[]) {
  if (path.length === 0) {
    return null;
  }

  return path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : String(segment),
    )
    .join(".");
}

function formatZodErrorMessage(error: z.ZodError): string {
  const [firstIssue] = error.issues;

  if (!firstIssue) {
    return "Validation error";
  }

  const path = formatZodIssuePath(firstIssue.path);
  return path ? `${path}: ${firstIssue.message}` : firstIssue.message;
}

function buildErrorBody(error: unknown) {
  const payload: {
    code?: string;
    details?: unknown;
    error: string;
  } = {
    error: resolveErrorMessage(error),
  };

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    payload.code = error.code;
  }

  if (error && typeof error === "object" && "details" in error) {
    payload.details = error.details;
  }

  return payload;
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
      {
        error: formatZodErrorMessage(error),
        details: z.treeifyError(error),
      },
      400,
    );
  }

  if (
    error instanceof RateNotFoundError ||
    error instanceof DocumentNotFoundError ||
    error instanceof NotFoundError
  ) {
    return c.json(buildErrorBody(error), 404);
  }

  if (
    error instanceof PermissionError ||
    error instanceof DocumentPolicyDeniedError
  ) {
    return c.json(buildErrorBody(error), 403);
  }

  if (
    error instanceof DocumentValidationError ||
    error instanceof DocumentGraphError ||
    error instanceof ValidationError
  ) {
    return c.json(buildErrorBody(error), 400);
  }

  if (
    error instanceof DocumentSystemOnlyTypeError ||
    error instanceof InvalidStateError ||
    error instanceof DocumentPostingNotRequiredError ||
    error instanceof ActionReceiptConflictError ||
    error instanceof ActionReceiptStoredError
  ) {
    return c.json(buildErrorBody(error), 409);
  }

  if (
    error instanceof RateSourceStaleError ||
    error instanceof RateSourceSyncError
  ) {
    return c.json(buildErrorBody(error), 503);
  }

  // Unknown error -- rethrow to let global handler return 500
  throw error;
}
