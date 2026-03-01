import { ServiceError } from "@bedrock/kernel/errors";

export class AccountingError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = "AccountingError";
  }
}

export class CorrespondenceRuleNotFoundError extends AccountingError {
  constructor(
    postingCode: string,
    debitAccountNo: string,
    creditAccountNo: string,
  ) {
    super(
      `Correspondence rule not found for postingCode=${postingCode}, debit=${debitAccountNo}, credit=${creditAccountNo}`,
    );
    this.name = "CorrespondenceRuleNotFoundError";
  }
}

export class AccountingPackCompilationError extends AccountingError {
  constructor(errors: string[]) {
    super(`Accounting pack compilation failed: ${errors.join("; ")}`);
    this.name = "AccountingPackCompilationError";
  }
}

export class UnknownPostingTemplateError extends AccountingError {
  constructor(templateKey: string) {
    super(`Unknown posting template: ${templateKey}`);
    this.name = "UnknownPostingTemplateError";
  }
}

export class AccountingTemplateAccessError extends AccountingError {
  constructor(accountingSourceId: string, templateKey: string) {
    super(
      `Accounting source ${accountingSourceId} is not allowed to use template ${templateKey}`,
    );
    this.name = "AccountingTemplateAccessError";
  }
}

export class AccountingPostingPlanValidationError extends AccountingError {
  constructor(message: string) {
    super(message);
    this.name = "AccountingPostingPlanValidationError";
  }
}

export class AccountingPackNotFoundError extends AccountingError {
  constructor(checksum: string) {
    super(`Compiled accounting pack not found: ${checksum}`);
    this.name = "AccountingPackNotFoundError";
  }
}
