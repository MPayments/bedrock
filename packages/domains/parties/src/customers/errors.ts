import { ServiceError } from "@multihansa/common/errors";

export class CustomerError extends ServiceError {}

export class CustomerNotFoundError extends CustomerError {
    name = "CustomerNotFoundError";

    constructor(id: string) {
        super(`Customer not found: ${id}`);
    }
}

export class CustomerDeleteConflictError extends CustomerError {
    name = "CustomerDeleteConflictError";

    constructor(id: string) {
        super(`Customer ${id} is referenced by payment orders`);
    }
}

export class CustomerInvariantError extends CustomerError {
    name = "CustomerInvariantError";
}
