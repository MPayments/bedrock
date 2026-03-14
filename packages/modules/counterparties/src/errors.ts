import { ServiceError } from "@bedrock/core/errors";

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
    super(`Managed counterparty group cannot be deleted: ${id}`);
  }
}
