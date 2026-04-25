import { ServiceError } from "@bedrock/shared/core/errors";

class FeesError extends ServiceError {}

export class FeeValidationError extends FeesError {
  name = "FeeValidationError";
}
