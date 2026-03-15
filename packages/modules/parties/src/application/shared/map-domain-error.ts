import { DomainError, readCauseString } from "@bedrock/shared/core/domain";

import {
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyRequisiteNotFoundError,
  CounterpartySystemGroupDeleteError,
} from "../../errors";

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
