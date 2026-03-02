import { ServiceError } from "@bedrock/kernel/errors";

export class FeesError extends ServiceError {}

export class FeeValidationError extends FeesError {
  name = "FeeValidationError";
}
