import {
  NotFoundError,
  ValidationError,
} from "@bedrock/shared/core/errors";

export class AgreementNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Agreement", id);
  }
}

export class AgreementRequisiteOwnershipError extends ValidationError {
  constructor(requisiteId: string, organizationId: string) {
    super(
      `Organization requisite ${requisiteId} does not belong to organization ${organizationId}`,
    );
  }
}

export class AgreementRequisiteBindingMissingError extends ValidationError {
  constructor(requisiteId: string) {
    super(
      `Organization requisite binding is missing for requisite ${requisiteId}`,
    );
  }
}
