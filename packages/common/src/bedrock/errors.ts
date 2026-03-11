import { defineDomainError, defineHttpError } from "@bedrock/core";
import { z } from "zod";

export const MessageDetailsSchema = z.object({
  message: z.string(),
});

export const NotFoundDomainError = defineDomainError(
  "MULTIHANSA_NOT_FOUND",
  {
    details: MessageDetailsSchema,
  },
);

export const ConflictDomainError = defineDomainError(
  "MULTIHANSA_CONFLICT",
  {
    details: MessageDetailsSchema,
  },
);

export const BadRequestDomainError = defineDomainError(
  "MULTIHANSA_BAD_REQUEST",
  {
    details: MessageDetailsSchema,
  },
);

export const ForbiddenDomainError = defineDomainError(
  "MULTIHANSA_FORBIDDEN",
  {
    details: MessageDetailsSchema,
  },
);

export const ServiceUnavailableDomainError = defineDomainError(
  "MULTIHANSA_SERVICE_UNAVAILABLE",
  {
    details: MessageDetailsSchema,
  },
);

export const MissingIdempotencyKeyDomainError = defineDomainError(
  "MULTIHANSA_MISSING_IDEMPOTENCY_KEY",
  {
    details: MessageDetailsSchema,
  },
);

export const NotFoundHttpError = defineHttpError("MULTIHANSA_NOT_FOUND", {
  status: 404,
  description: "Resource not found",
  details: MessageDetailsSchema,
});

export const ConflictHttpError = defineHttpError("MULTIHANSA_CONFLICT", {
  status: 409,
  description: "Conflict",
  details: MessageDetailsSchema,
});

export const BadRequestHttpError = defineHttpError("MULTIHANSA_BAD_REQUEST", {
  status: 400,
  description: "Bad request",
  details: MessageDetailsSchema,
});

export const ForbiddenHttpError = defineHttpError("MULTIHANSA_FORBIDDEN", {
  status: 403,
  description: "Forbidden",
  details: MessageDetailsSchema,
});

export const ServiceUnavailableHttpError = defineHttpError(
  "MULTIHANSA_SERVICE_UNAVAILABLE",
  {
    status: 503,
    description: "Service unavailable",
    details: MessageDetailsSchema,
  },
);

export const MissingIdempotencyKeyHttpError = defineHttpError(
  "MULTIHANSA_MISSING_IDEMPOTENCY_KEY",
  {
    status: 400,
    description: "Idempotency key is required",
    details: MessageDetailsSchema,
  },
);

export const RouteErrorMappings = {
  MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
  MULTIHANSA_CONFLICT: ConflictHttpError,
  MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
  MULTIHANSA_MISSING_IDEMPOTENCY_KEY: MissingIdempotencyKeyHttpError,
  MULTIHANSA_NOT_FOUND: NotFoundHttpError,
  MULTIHANSA_SERVICE_UNAVAILABLE: ServiceUnavailableHttpError,
} as const;
