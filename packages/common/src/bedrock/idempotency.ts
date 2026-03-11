import { error, type DomainErrorInstance, type ErrorResult } from "@bedrock/core";

import { MissingIdempotencyKeyDomainError } from "./errors";
import { RequestContextToken } from "./request-context";

export function requireIdempotencyKey(requestContext: {
  idempotencyKey: string | null;
}): string | ErrorResult<DomainErrorInstance<typeof MissingIdempotencyKeyDomainError>> {
  if (!requestContext.idempotencyKey) {
    return error(MissingIdempotencyKeyDomainError, {
      message: "Missing Idempotency-Key header",
    });
  }

  return requestContext.idempotencyKey;
}

export { RequestContextToken };
