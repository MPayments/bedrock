import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@bedrock/shared/core/errors";

export class DealNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Deal", id);
  }
}

export class DealRevisionConflictError extends InvalidStateError {
  constructor(dealId: string, expectedRevision: number) {
    super(
      `Deal ${dealId} revision conflict: expected revision ${expectedRevision}`,
    );
  }
}

export class DealAgreementCustomerMismatchError extends ValidationError {
  constructor(agreementId: string, customerId: string) {
    super(
      `Agreement ${agreementId} does not belong to customer ${customerId}`,
    );
  }
}

export class DealAgreementInactiveError extends ValidationError {
  constructor(agreementId: string) {
    super(`Agreement ${agreementId} is inactive`);
  }
}

export class DealCalculationInactiveError extends ValidationError {
  constructor(calculationId: string) {
    super(`Calculation ${calculationId} is inactive`);
  }
}

export class DealTypeNotSupportedError extends ValidationError {
  constructor(type: string) {
    super(`Deal type ${type} is not supported in Phase 17`);
  }
}

export class DealActiveAgreementNotFoundError extends ValidationError {
  constructor(customerId: string) {
    super(`Customer ${customerId} does not have an active agreement`);
  }
}

export class DealActiveAgreementAmbiguousError extends ValidationError {
  constructor(customerId: string) {
    super(`Customer ${customerId} has multiple active agreements`);
  }
}

export class DealRequestedAmountCurrencyMismatchError extends ValidationError {
  constructor() {
    super("requestedAmount and requestedCurrencyId must be provided together");
  }
}

export class DealStatusTransitionError extends ValidationError {
  constructor(from: string, to: string) {
    super(`Cannot transition deal status from ${from} to ${to}`);
  }
}

export class DealQuoteNotAcceptedError extends ValidationError {
  constructor(dealId: string, quoteId: string) {
    super(`Quote ${quoteId} is not the accepted quote for deal ${dealId}`);
  }
}

export class DealQuoteDealMismatchError extends ValidationError {
  constructor(dealId: string, quoteId: string) {
    super(`Quote ${quoteId} is not linked to deal ${dealId}`);
  }
}

export class DealQuoteInactiveError extends ValidationError {
  constructor(quoteId: string, status: string) {
    super(`Quote ${quoteId} is not active: ${status}`);
  }
}
