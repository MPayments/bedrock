import {
  NotFoundError,
  ValidationError,
} from "@bedrock/shared/core/errors";

export class CalculationNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Calculation", id);
  }
}

export class CalculationFxQuoteCurrencyMismatchError extends ValidationError {
  constructor(quoteId: string, context: "primary" | "additional_expenses") {
    super(
      `FX quote ${quoteId} does not match the ${context} calculation currencies`,
    );
  }
}

export class CalculationFxQuoteRateMismatchError extends ValidationError {
  constructor(quoteId: string, context: "primary" | "additional_expenses") {
    super(
      `FX quote ${quoteId} does not match the stored ${context} rate fields`,
    );
  }
}

export class PaymentRouteTemplateNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Payment route template", id);
  }
}

export class DealCalculationSourceNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Deal", id);
  }
}

export class DealCalculationQuoteNotAcceptedError extends ValidationError {
  constructor(dealId: string, quoteId: string) {
    super(`Quote ${quoteId} is not the accepted quote for deal ${dealId}`);
  }
}

export class DealCalculationQuoteInactiveError extends ValidationError {
  constructor(quoteId: string, status: string) {
    super(`Quote ${quoteId} is not active: ${status}`);
  }
}
