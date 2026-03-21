import { ServiceError } from "@bedrock/shared/core/errors";

export class CustomerError extends ServiceError {}

export class CustomerNotFoundError extends CustomerError {
  constructor(id: string) {
    super(`Customer not found: ${id}`);
  }
}

export class CustomerDeleteConflictError extends CustomerError {
  constructor(id: string) {
    super(`Customer ${id} is referenced by documents`);
  }
}
