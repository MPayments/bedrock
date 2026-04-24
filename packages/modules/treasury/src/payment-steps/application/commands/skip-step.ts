import { loadPaymentStep } from "./shared";
import type { PaymentStepsServiceContext } from "../context";
import {
  SkipPaymentStepInputSchema,
  type SkipPaymentStepInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createSkipPaymentStepHandler(
  context: PaymentStepsServiceContext,
) {
  return async function skipPaymentStep(raw: SkipPaymentStepInput) {
    const input = SkipPaymentStepInputSchema.parse(raw);
    const skipped = (await loadPaymentStep(context, input.stepId)).skip(
      context.runtime.now(),
    );

    await context.repository.updateStep(skipped.toSnapshot());

    return mapPaymentStep(skipped.toSnapshot());
  };
}
