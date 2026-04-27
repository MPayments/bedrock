import {
  PaymentStepSchema,
  type PaymentStep as PaymentStepDto,
} from "../contracts/dto";
import type { PaymentStepRecord } from "../domain/types";

export function mapPaymentStep(record: PaymentStepRecord): PaymentStepDto {
  return PaymentStepSchema.parse(record);
}
