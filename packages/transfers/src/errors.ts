import {
    ServiceError,
    InvalidStateError as BaseInvalidStateError,
} from "@bedrock/kernel/errors";

export { ValidationError, NotFoundError, PermissionError } from "@bedrock/kernel/errors";

export class TransfersError extends ServiceError { }

export class InvalidStateError extends BaseInvalidStateError {
    constructor(
        message: string,
        public readonly currentStatus?: string,
        public readonly expectedStatuses?: string[]
    ) {
        super(message);
    }
}
