import { ServiceError } from "@bedrock/shared/core/errors";

export class FeesError extends ServiceError {}

export class FeeValidationError extends FeesError {
  name = "FeeValidationError";
}
