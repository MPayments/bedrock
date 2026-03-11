import { ServiceError } from "@multihansa/common/errors";

export class FeesError extends ServiceError {}

export class FeeValidationError extends FeesError {
  name = "FeeValidationError";
}
