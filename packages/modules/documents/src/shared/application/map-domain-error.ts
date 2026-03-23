import { DomainError } from "@bedrock/shared/core/domain";
import { InvalidStateError } from "@bedrock/shared/core/errors";

import {
  DocumentPostingNotRequiredError,
} from "../../errors";

export function mapDocumentDomainError(
  error: unknown,
  input?: { documentId?: string; docType?: string },
): Error {
  if (!(error instanceof DomainError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  switch (error.code) {
    case "document.post_not_required":
      return new DocumentPostingNotRequiredError(
        input?.documentId ?? "unknown",
        input?.docType ?? "unknown",
      );
    default:
      return new InvalidStateError(error.message);
  }
}
