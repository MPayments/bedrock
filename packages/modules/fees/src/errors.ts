import { ServiceError } from "@bedrock/core/errors";

export class FeesError extends ServiceError {}

export class FeeValidationError extends FeesError {
  name = "FeeValidationError";
}
