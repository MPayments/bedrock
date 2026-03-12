import { ServiceError } from "@bedrock/kernel/errors";

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

  constructor(counterpartyId: string) {
    super(`Counterparty is not an internal ledger entity: ${counterpartyId}`);
  }
}

export class InternalLedgerInvariantViolationError extends CounterpartyError {
  name = "InternalLedgerInvariantViolationError";
}
