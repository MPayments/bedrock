import { ServiceError } from "@bedrock/kernel/errors";

export { ValidationError } from "@bedrock/kernel/errors";

export class AccountError extends ServiceError {}

export class AccountNotFoundError extends AccountError {
  name = "AccountNotFoundError";

  constructor(id: string) {
    super(`Account not found: ${id}`);
  }
}

export class AccountProviderNotFoundError extends AccountError {
  name = "AccountProviderNotFoundError";

  constructor(id: string) {
    super(`Account provider not found: ${id}`);
  }
}

export class AccountProviderInUseError extends AccountError {
  name = "AccountProviderInUseError";

  constructor(id: string) {
    super(`Account provider is in use and cannot be deleted: ${id}`);
  }
}
