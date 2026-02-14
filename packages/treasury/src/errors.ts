import { ServiceError } from "@bedrock/kernel/errors";

export {
  InvalidStateError,
  NotFoundError,
  ValidationError,
  AmountMismatchError,
  CurrencyMismatchError,
} from "@bedrock/kernel/errors";

export class PaymentsError extends ServiceError {
  constructor(message = "") {
    super(message);
    this.name = "PaymentsError";
  }
}
