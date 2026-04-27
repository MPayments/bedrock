import { loadPaymentStep } from "./shared";
import type { PaymentStepsServiceContext } from "../context";
import {
  CancelPaymentStepInputSchema,
  type CancelPaymentStepInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createCancelPaymentStepHandler(
  context: PaymentStepsServiceContext,
) {
  return async function cancelPaymentStep(raw: CancelPaymentStepInput) {
    const input = CancelPaymentStepInputSchema.parse(raw);
    const cancelled = (await loadPaymentStep(context, input.stepId)).cancel(
      context.runtime.now(),
    );

    await context.repository.updateStep(cancelled.toSnapshot());

    return mapPaymentStep(cancelled.toSnapshot());
  };
}
