import { loadPaymentStep } from "./shared";
import type { PaymentStepsServiceContext } from "../context";
import {
  ConfirmPaymentStepInputSchema,
  type ConfirmPaymentStepInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createConfirmPaymentStepHandler(
  context: PaymentStepsServiceContext,
) {
  return async function confirmPaymentStep(raw: ConfirmPaymentStepInput) {
    const input = ConfirmPaymentStepInputSchema.parse(raw);
    const now = context.runtime.now();
    const current = await loadPaymentStep(context, input.stepId);
    const confirmed = current.confirm({
      artifacts: input.artifacts,
      attemptId: input.attemptId,
      failureReason: input.failureReason,
      outcome: input.outcome,
      outcomeAt: now,
    });

    await context.repository.updateStep(confirmed.toSnapshot());

    return mapPaymentStep(confirmed.toSnapshot());
  };
}
