import { NotFoundError, ServiceError, ValidationError } from "@bedrock/core/errors";

export class ReconciliationError extends ServiceError {}

export class ExternalRecordConflictError extends ValidationError {
  constructor(source: string, sourceRecordId: string) {
    super(
      `External record already exists with a different payload: ${source}:${sourceRecordId}`,
    );
  }
}

export class ReconciliationMatchNotFoundError extends NotFoundError {
  constructor(matchId: string) {
    super("Reconciliation match", matchId);
  }
}

export class ReconciliationExceptionNotFoundError extends NotFoundError {
  constructor(exceptionId: string) {
    super("Reconciliation exception", exceptionId);
  }
}
