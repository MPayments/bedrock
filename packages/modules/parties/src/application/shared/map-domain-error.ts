import { DomainError } from "@bedrock/shared/core/domain";

import {
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyRequisiteNotFoundError,
  CounterpartySystemGroupDeleteError,
} from "../../errors";

function readCauseString(error: DomainError, key: string): string | null {
  if (
    error.cause &&
    typeof error.cause === "object" &&
    key in error.cause &&
    typeof (error.cause as Record<string, unknown>)[key] === "string"
  ) {
    return (error.cause as Record<string, string | undefined>)[key] ?? null;
  }

  return null;
}

export function rethrowCounterpartyGroupDomainError(error: unknown): never {
  if (!(error instanceof DomainError)) {
    throw error;
  }

  if (error.code === "counterparty_group.not_found") {
    throw new CounterpartyGroupNotFoundError(
      readCauseString(error, "groupId") ?? error.message,
    );
  }

  if (error.code === "counterparty_group.delete_forbidden") {
    throw new CounterpartySystemGroupDeleteError(
      readCauseString(error, "groupId") ?? error.message,
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
      readCauseString(error, "groupId") ?? error.message,
    );
  }

  throw new CounterpartyGroupRuleError(error.message);
}

export function rethrowCounterpartyRequisiteDomainError(error: unknown): never {
  if (!(error instanceof DomainError)) {
    throw error;
  }

  if (error.code === "counterparty_requisite.not_found_in_set") {
    throw new CounterpartyRequisiteNotFoundError(
      readCauseString(error, "requisiteId") ?? error.message,
    );
  }

  throw error;
}
