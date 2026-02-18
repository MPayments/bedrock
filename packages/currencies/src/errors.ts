import { ServiceError } from "@bedrock/kernel/errors";

export class CurrencyNotFoundError extends ServiceError {
    constructor(identifier: string) {
        super(`Currency not found: ${identifier}`);
    }
}
