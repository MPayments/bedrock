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
