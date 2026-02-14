export class FeesError extends Error {
    name = "FeesError";

    constructor(message: string, readonly cause?: unknown) {
        super(message);
    }
}

export class FeeValidationError extends FeesError {
    name = "FeeValidationError";
}
