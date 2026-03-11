import {
  InvalidStateError,
  NotFoundError,
  PermissionError,
  ServiceError,
  ValidationError,
} from "@multihansa/common/errors";

export class DocumentsError extends ServiceError {}

export class DocumentNotFoundError extends NotFoundError {
  constructor(documentId: string) {
    super("Document", documentId);
  }
}

export class DocumentValidationError extends ValidationError {}

export class DocumentRegistryError extends DocumentsError {}

export class DocumentSystemOnlyTypeError extends DocumentValidationError {
  constructor(public readonly docType: string) {
    super(`Document type "${docType}" is system-only and cannot be mutated via public API`);
  }
}

export class DocumentPostingNotRequiredError extends InvalidStateError {
  constructor(documentId: string, docType: string) {
    super(`Document ${documentId} (${docType}) does not support posting`);
  }
}

export class DocumentGraphError extends DocumentsError {}

export class DocumentAccountingSourceCoverageError extends DocumentsError {
  constructor(
    public readonly packChecksum: string,
    public readonly missingSources: string[],
  ) {
    super(
      `Active accounting pack ${packChecksum} is missing sources: ${missingSources.join(", ")}`,
    );
  }
}

export class DocumentPolicyDeniedError extends PermissionError {
  constructor(
    public readonly action: string,
    public readonly reasonCode: string,
    public readonly reasonMeta?: Record<string, unknown> | null,
  ) {
    super(`Document action denied for ${action}: ${reasonCode}`);
  }
}
