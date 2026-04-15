import {
  InvalidStateError,
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

export class AgreementRootLinksImmutableError extends ValidationError {
  constructor() {
    super(
      "Agreement root links are immutable in Phase 13. Update contract terms only.",
    );
  }
}

export class AgreementActiveCustomerInvariantError extends InvalidStateError {
  constructor(customerId: string) {
    super(
      `Expected at most one active agreement for customer ${customerId}`,
    );
  }
}

export class AgreementRouteTemplateUnavailableError extends ValidationError {
  constructor(templateId: string) {
    super(`Route template ${templateId} is unavailable for agreement defaults`);
  }
}

export class AgreementRouteTemplateDealTypeMismatchError extends ValidationError {
  constructor(
    templateId: string,
    templateDealType: string,
    policyDealType: string,
  ) {
    super(
      `Route template ${templateId} has deal type ${templateDealType}, expected ${policyDealType}`,
    );
  }
}
