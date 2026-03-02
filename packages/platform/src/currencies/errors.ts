import { ServiceError } from "@bedrock/foundation/kernel/errors";

export class CurrencyError extends ServiceError {}

export class CurrencyNotFoundError extends CurrencyError {
    name = "CurrencyNotFoundError";

    constructor(identifier: string) {
        super(`Currency not found: ${identifier}`);
    }
}

export class CurrencyDeleteConflictError extends CurrencyError {
    name = "CurrencyDeleteConflictError";

    constructor(id: string) {
        super(`Currency ${id} is referenced by existing records`);
    }
}
