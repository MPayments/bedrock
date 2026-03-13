import { ServiceError } from "@bedrock/core/errors";

export class OrganizationError extends ServiceError {}

export class OrganizationNotFoundError extends OrganizationError {
  name = "OrganizationNotFoundError";

  constructor(id: string) {
    super(`Organization not found: ${id}`);
  }
}

export class OrganizationDeleteConflictError extends OrganizationError {
  name = "OrganizationDeleteConflictError";

  constructor(id: string) {
    super(`Organization ${id} is referenced by existing records`);
  }
}
