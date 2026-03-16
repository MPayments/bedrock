import { ServiceError } from "@bedrock/shared/core/errors";
export { RequisiteProviderNotActiveError } from "@bedrock/requisite-providers";

export class CustomerError extends ServiceError {}

export class CustomerNotFoundError extends CustomerError {
  name = "CustomerNotFoundError";

  constructor(id: string) {
    super(`Customer not found: ${id}`);
  }
}

export class CustomerDeleteConflictError extends CustomerError {
  name = "CustomerDeleteConflictError";

  constructor(id: string) {
    super(`Customer ${id} is referenced by payment orders`);
  }
}

export class CustomerInvariantError extends CustomerError {
  name = "CustomerInvariantError";
}

export class CounterpartyError extends ServiceError {}

export class CounterpartyNotFoundError extends CounterpartyError {
  name = "CounterpartyNotFoundError";

  constructor(id: string) {
    super(`Counterparty not found: ${id}`);
  }
}

export class CounterpartyGroupNotFoundError extends CounterpartyError {
  name = "CounterpartyGroupNotFoundError";

  constructor(id: string) {
    super(`Counterparty group not found: ${id}`);
  }
}

export class CounterpartyGroupRuleError extends CounterpartyError {
  name = "CounterpartyGroupRuleError";
}

export class CounterpartyCustomerNotFoundError extends CounterpartyError {
  name = "CounterpartyCustomerNotFoundError";

  constructor(id: string) {
    super(`Customer not found: ${id}`);
  }
}

export class CounterpartySystemGroupDeleteError extends CounterpartyError {
  name = "CounterpartySystemGroupDeleteError";

  constructor(id: string) {
    super(`System counterparty group cannot be deleted: ${id}`);
  }
}

export class CounterpartyNotInternalLedgerEntityError extends CounterpartyError {
  name = "CounterpartyNotInternalLedgerEntityError";

  constructor(id: string) {
    super(`Counterparty is not an internal ledger entity: ${id}`);
  }
}

export class InternalLedgerInvariantViolationError extends CounterpartyError {
  name = "InternalLedgerInvariantViolationError";
}

export class CounterpartyRequisiteNotFoundError extends CounterpartyError {
  name = "CounterpartyRequisiteNotFoundError";

  constructor(id: string) {
    super(`Counterparty requisite not found: ${id}`);
  }
}
