export class FxError extends Error {
    name = "FxError";
}

export class ValidationError extends FxError {
    name = "ValidationError";
}

export class NotFoundError extends FxError {
    name = "NotFoundError";

    constructor(
        public readonly entityType: string,
        public readonly entityId: string
    ) {
        super(`${entityType} not found: ${entityId}`);
    }
}

export class RateNotFoundError extends FxError {
    name = "RateNotFoundError";
}

export class QuoteExpiredError extends FxError {
    name = "QuoteExpiredError";
}

export class PolicyNotFoundError extends FxError {
    name = "PolicyNotFoundError";

    constructor(policyId: string) {
        super(`Policy not found or inactive: ${policyId}`);
    }
}
