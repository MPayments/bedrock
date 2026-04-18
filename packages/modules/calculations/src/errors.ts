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
