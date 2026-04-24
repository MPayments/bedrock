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
  ConflictError,
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

type ErrorConstructorLike = abstract new (...args: any[]) => Error;
type RouteErrorStatus = 400 | 403 | 404 | 409 | 503;

const ROUTE_ERROR_STATUS_GROUPS = [
  {
    status: 404,
    errors: [RateNotFoundError, DocumentNotFoundError, NotFoundError],
  },
  {
    status: 403,
    errors: [PermissionError, DocumentPolicyDeniedError],
  },
  {
    status: 400,
    errors: [DocumentValidationError, DocumentGraphError, ValidationError],
  },
  {
    status: 409,
    errors: [
      DocumentSystemOnlyTypeError,
      InvalidStateError,
      ConflictError,
      DocumentPostingNotRequiredError,
      ActionReceiptConflictError,
      ActionReceiptStoredError,
    ],
  },
  {
    status: 503,
    errors: [RateSourceStaleError, RateSourceSyncError],
  },
] as const satisfies {
  errors: readonly ErrorConstructorLike[];
  status: RouteErrorStatus;
}[];

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

function resolveKnownErrorStatus(error: unknown): RouteErrorStatus | null {
  for (const group of ROUTE_ERROR_STATUS_GROUPS) {
    if (group.errors.some((ErrorType) => error instanceof ErrorType)) {
      return group.status;
    }
  }

  return null;
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

  const status = resolveKnownErrorStatus(error);
  if (status) {
    return c.json(buildErrorBody(error), status);
  }

  // Unknown error -- rethrow to let global handler return 500
  throw error;
}
