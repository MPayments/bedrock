import { ServiceError } from "@bedrock/foundation/kernel/errors";

export class FeesError extends ServiceError {}

export class FeeValidationError extends FeesError {
  name = "FeeValidationError";
}
