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

export class MakerCheckerViolationError extends TransfersError {
    constructor() {
        super("checkerUserId must differ from makerUserId");
    }
}

export class TransferCurrencyMismatchError extends TransfersError {
    constructor(sourceCurrencyId: string, destinationCurrencyId: string) {
        super(`Cross-account transfer requires same currency. source=${sourceCurrencyId}, destination=${destinationCurrencyId}`);
    }
}

export class InsufficientFundsError extends TransfersError {
    constructor(
        public readonly operationalAccountId: string,
        public readonly currency: string,
        public readonly available: bigint,
        public readonly required: bigint
    ) {
        super(
            `Insufficient funds for operationalAccountId=${operationalAccountId}, currency=${currency}: available=${available}, required=${required}`
        );
    }
}
