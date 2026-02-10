export class TransfersError extends Error {
    name = "TransfersError";
}

export class ValidationError extends TransfersError {
    name = "ValidationError";
}

export class NotFoundError extends TransfersError {
    name = "NotFoundError";

    constructor(
        public readonly entityType: string,
        public readonly entityId: string
    ) {
        super(`${entityType} not found: ${entityId}`);
    }
}

export class InvalidStateError extends TransfersError {
    name = "InvalidStateError";

    constructor(
        message: string,
        public readonly currentStatus?: string,
        public readonly expectedStatuses?: string[]
    ) {
        super(message);
    }
}

export class PermissionError extends TransfersError {
    name = "PermissionError";
}
  