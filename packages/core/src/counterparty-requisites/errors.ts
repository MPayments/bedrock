import { ServiceError } from "@bedrock/kernel/errors";

export { ValidationError } from "@bedrock/kernel/errors";

export class CounterpartyRequisiteError extends ServiceError {}

export class CounterpartyRequisiteNotFoundError extends CounterpartyRequisiteError {
  name = "CounterpartyRequisiteNotFoundError";

  constructor(id: string) {
    super(`Counterparty requisite not found: ${id}`);
  }
}

export class CounterpartyRequisiteOwnerInternalError extends CounterpartyRequisiteError {
  name = "CounterpartyRequisiteOwnerInternalError";

  constructor(counterpartyId: string) {
    super(
      `Counterparty requisite owner must not be an internal ledger entity: ${counterpartyId}`,
    );
  }
}
