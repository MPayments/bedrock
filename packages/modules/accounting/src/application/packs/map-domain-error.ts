import { DomainError, readCauseString } from "@bedrock/shared/core/domain";

import {
  AccountingPackCompilationError,
  AccountingPackVersionConflictError,
  AccountingPostingPlanValidationError,
  AccountingTemplateAccessError,
  UnknownPostingTemplateError,
} from "../../errors";

export function rethrowAccountingPacksDomainError(error: unknown): never {
  if (!(error instanceof DomainError)) {
    throw error;
  }

  if (
    error.code === "accounting_pack.compilation_failed" ||
    error.code === "accounting_pack.checksum_mismatch"
  ) {
    throw new AccountingPackCompilationError(error.message);
  }

  if (error.code === "accounting_pack.unknown_template") {
    throw new UnknownPostingTemplateError(
      readCauseString(error, "templateKey") ?? error.message,
    );
  }

  if (error.code === "accounting_pack.template_access_forbidden") {
    throw new AccountingTemplateAccessError(
      readCauseString(error, "accountingSourceId") ?? error.message,
      readCauseString(error, "templateKey") ?? error.message,
    );
  }

  if (error.code === "accounting_pack.version_conflict") {
    throw new AccountingPackVersionConflictError(
      readCauseString(error, "packKey") ?? error.message,
      Number(readCauseString(error, "version") ?? 0),
      readCauseString(error, "existingChecksum") ?? error.message,
      readCauseString(error, "nextChecksum") ?? error.message,
    );
  }

  if (error.code.startsWith("accounting_pack.")) {
    throw new AccountingPostingPlanValidationError(error.message);
  }

  throw error;
}
