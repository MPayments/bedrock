import { ServiceError } from "@bedrock/shared/core/errors";

export class AccountingError extends ServiceError {}

export class CorrespondenceRuleNotFoundError extends AccountingError {
  constructor(
    postingCode: string,
    debitAccountNo: string,
    creditAccountNo: string,
  ) {
    super(
      `Correspondence rule not found for postingCode=${postingCode}, debit=${debitAccountNo}, credit=${creditAccountNo}`,
    );
  }
}

export class AccountingPackCompilationError extends AccountingError {}

export class UnknownPostingTemplateError extends AccountingError {
  constructor(templateKey: string) {
    super(`Unknown posting template: ${templateKey}`);
  }
}

export class AccountingTemplateAccessError extends AccountingError {
  constructor(accountingSourceId: string, templateKey: string) {
    super(
      `Accounting source ${accountingSourceId} is not allowed to use template ${templateKey}`,
    );
  }
}

export class AccountingPostingPlanValidationError extends AccountingError {}

export class AccountingPackNotFoundError extends AccountingError {
  constructor(checksum: string) {
    super(`Compiled accounting pack not found: ${checksum}`);
  }
}

export class AccountingPackVersionConflictError extends AccountingError {
  constructor(
    packKey: string,
    version: number,
    existingChecksum: string,
    nextChecksum: string,
  ) {
    super(
      `Accounting pack ${packKey}@${version} already exists with checksum ${existingChecksum}; cannot replace with ${nextChecksum} because existing checksum is already assigned`,
    );
  }
}
