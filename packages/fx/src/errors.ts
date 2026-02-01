export class FxError extends Error {
    name = "FxError";
}

export class RateNotFoundError extends FxError {
    name = "RateNotFoundError";
}

export class QuoteExpiredError extends FxError {
    name = "QuoteExpiredError";
}
