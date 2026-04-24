import { PaymentStepNotFoundError } from "../../../errors";
import type { PaymentStepsServiceContext } from "../context";
import {
  GetPaymentStepByIdInputSchema,
  type GetPaymentStepByIdInput,
} from "../contracts/queries";
import { mapPaymentStep } from "../map-payment-step";

export function createGetPaymentStepByIdQuery(
  context: PaymentStepsServiceContext,
) {
  return async function getPaymentStepById(raw: GetPaymentStepByIdInput) {
    const input = GetPaymentStepByIdInputSchema.parse(raw);
    const record = await context.repository.findStepById(input.stepId);

    if (!record) {
      throw new PaymentStepNotFoundError(input.stepId);
    }

    return mapPaymentStep(record);
  };
}
