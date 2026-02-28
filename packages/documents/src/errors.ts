import { InvalidStateError, NotFoundError, ServiceError, ValidationError } from "@bedrock/kernel/errors";

export class DocumentsError extends ServiceError {}

export class DocumentNotFoundError extends NotFoundError {
  constructor(documentId: string) {
    super("Document", documentId);
  }
}

export class DocumentValidationError extends ValidationError {}

export class DocumentRegistryError extends DocumentsError {}

export class DocumentPostingNotRequiredError extends InvalidStateError {
  constructor(documentId: string, docType: string) {
    super(`Document ${documentId} (${docType}) does not support posting`);
  }
}

export class DocumentGraphError extends DocumentsError {}
