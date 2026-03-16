import { DomainError, readCauseString } from "@bedrock/shared/core/domain";

import { OrganizationRequisiteNotFoundError } from "../../errors";

export function rethrowOrganizationRequisiteDomainError(error: unknown): never {
  if (!(error instanceof DomainError)) {
    throw error;
  }

  if (error.code === "organization_requisite.not_found_in_set") {
    throw new OrganizationRequisiteNotFoundError(
      readCauseString(error, "requisiteId") ?? error.message,
    );
  }

  throw error;
}
