import { ServiceError } from "@bedrock/kernel/errors";


export class OrganizationError extends ServiceError {}

export class OrganizationNotFoundError extends OrganizationError {
    name = "OrganizationNotFoundError";

    constructor(id: string) {
        super(`Organization not found: ${id}`);
    }
}
