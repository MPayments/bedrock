import { DomainError } from "@bedrock/shared/core/domain";
import { ServiceError } from "@bedrock/shared/core/errors";

function readMetaString(
  error: DomainError,
  key: string,
): string | undefined {
  const value = error.meta?.[key];
  return typeof value === "string" ? value : undefined;
}

export class CounterpartyError extends ServiceError {}

export class CounterpartyNotFoundError extends CounterpartyError {
  constructor(id: string) {
    super(`Counterparty not found: ${id}`);
  }
}

export class CounterpartyGroupNotFoundError extends CounterpartyError {
  constructor(id: string) {
    super(`Counterparty group not found: ${id}`);
  }
}

export class CounterpartyGroupRuleError extends CounterpartyError {}

export class CounterpartyCustomerNotFoundError extends CounterpartyError {
  constructor(id: string) {
    super(`Customer not found: ${id}`);
  }
}

export class CounterpartySystemGroupDeleteError extends CounterpartyError {
  constructor(id: string) {
    super(`System counterparty group cannot be deleted: ${id}`);
  }
}

export function rethrowCounterpartyGroupDomainError(error: unknown): never {
  if (!(error instanceof DomainError)) {
    throw error;
  }

  if (error.code === "counterparty_group.not_found") {
    throw new CounterpartyGroupNotFoundError(
      readMetaString(error, "groupId") ?? error.message,
    );
  }

  if (error.code === "counterparty_group.delete_forbidden") {
    throw new CounterpartySystemGroupDeleteError(
      readMetaString(error, "groupId") ?? error.message,
    );
  }

  throw new CounterpartyGroupRuleError(error.message);
}

export function rethrowCounterpartyMembershipDomainError(error: unknown): never {
  if (!(error instanceof DomainError)) {
    throw error;
  }

  if (error.code === "counterparty_group.not_found") {
    throw new CounterpartyGroupNotFoundError(
      readMetaString(error, "groupId") ?? error.message,
    );
  }

  throw new CounterpartyGroupRuleError(error.message);
}
