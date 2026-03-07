import { ServiceError } from "@bedrock/kernel/errors";

export { ValidationError } from "@bedrock/kernel/errors";

export class OrganizationRequisiteError extends ServiceError {}

export class OrganizationRequisiteNotFoundError extends OrganizationRequisiteError {
  name = "OrganizationRequisiteNotFoundError";

  constructor(id: string) {
    super(`Organization requisite not found: ${id}`);
  }
}

export class OrganizationRequisiteOwnerNotInternalError extends OrganizationRequisiteError {
  name = "OrganizationRequisiteOwnerNotInternalError";

  constructor(organizationId: string) {
    super(
      `Organization requisite owner must be an internal ledger entity: ${organizationId}`,
    );
  }
}

export class OrganizationRequisiteBindingNotFoundError extends OrganizationRequisiteError {
  name = "OrganizationRequisiteBindingNotFoundError";

  constructor(requisiteId: string) {
    super(`Organization requisite binding not found: ${requisiteId}`);
  }
}
