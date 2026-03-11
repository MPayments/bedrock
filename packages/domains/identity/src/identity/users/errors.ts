import { ServiceError } from "@multihansa/common/errors";

export class UserError extends ServiceError {}

export class UserNotFoundError extends UserError {
    name = "UserNotFoundError";

    constructor(id: string) {
        super(`User not found: ${id}`);
    }
}

export class UserEmailConflictError extends UserError {
    name = "UserEmailConflictError";

    constructor(email: string) {
        super(`User with email already exists: ${email}`);
    }
}

export class InvalidPasswordError extends UserError {
    name = "InvalidPasswordError";

    constructor() {
        super("Current password is incorrect");
    }
}
