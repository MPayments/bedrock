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
  constructor(id: string) {
    super("Agent", id);
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

export class TodoNotFoundError extends NotFoundError {
  constructor(id: number) {
    super("Todo", String(id));
  }
}
