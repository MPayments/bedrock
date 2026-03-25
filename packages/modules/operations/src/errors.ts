import { NotFoundError, ServiceError } from "@bedrock/shared/core/errors";

export class OperationsError extends ServiceError {}

export class ActivityLogNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("ActivityLog", String(id));
  }
}

export class ContractNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Contract", String(id));
  }
}

export class ApplicationNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Application", String(id));
  }
}

export class ApplicationInvalidStatusTransitionError extends OperationsError {
  constructor(from: string, to: string) {
    super(`Invalid application status transition: ${from} → ${to}`);
  }
}

export class CalculationNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Calculation", String(id));
  }
}

export class DealNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Deal", String(id));
  }
}

export class DealInvalidStatusTransitionError extends OperationsError {
  constructor(from: string, to: string) {
    super(`Invalid deal status transition: ${from} → ${to}`);
  }
}

export class DealAlreadyExistsForApplicationError extends OperationsError {
  constructor(applicationId: number) {
    super(`Deal already exists for application: ${applicationId}`);
  }
}

export class ClientNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Client", String(id));
  }
}

export class ClientHasApplicationsError extends OperationsError {
  constructor(id: number) {
    super(`Cannot delete client ${id}: has existing applications`);
  }
}

export class AgentNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Agent", String(id));
  }
}

export class SubAgentNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("SubAgent", String(id));
  }
}

export class OrganizationNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Organization", String(id));
  }
}

export class BankDetailsNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("BankDetails", String(id));
  }
}

export class TodoNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Todo", String(id));
  }
}
