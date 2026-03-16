import { ServiceError } from "@bedrock/shared/core/errors";
export {
  RequisiteProviderNotActiveError,
} from "@bedrock/requisite-providers";

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

export class OrganizationInternalLedgerInvariantError extends OrganizationError {
  name = "OrganizationInternalLedgerInvariantError";
}

export class OrganizationRequisiteNotFoundError extends OrganizationError {
  name = "OrganizationRequisiteNotFoundError";

  constructor(id: string) {
    super(`Organization requisite not found: ${id}`);
  }
}

export class OrganizationRequisiteBindingNotFoundError extends OrganizationError {
  name = "OrganizationRequisiteBindingNotFoundError";

  constructor(id: string) {
    super(`Organization requisite accounting binding not found: ${id}`);
  }
}
