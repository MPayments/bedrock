import { ServiceError } from "@bedrock/kernel/errors";

export { ValidationError, NotFoundError } from "@bedrock/kernel/errors";

export class FxError extends ServiceError { }

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
