import { loadPaymentStep } from "./shared";
import type { PaymentStepsServiceContext } from "../context";
import {
  SubmitPaymentStepInputSchema,
  type SubmitPaymentStepInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createSubmitPaymentStepHandler(
  context: PaymentStepsServiceContext,
) {
  return async function submitPaymentStep(raw: SubmitPaymentStepInput) {
    const input = SubmitPaymentStepInputSchema.parse(raw);
    const now = context.runtime.now();
    const current = await loadPaymentStep(context, input.stepId);
    const snapshot = current.toSnapshot();
    const pending =
      snapshot.state === "draft" || snapshot.state === "scheduled"
        ? current.markPending(now)
        : current;
    const submitted = pending.submit({
      attemptId: input.attemptId ?? context.runtime.generateUuid(),
      providerRef: input.providerRef,
      providerSnapshot: input.providerSnapshot,
      submittedAt: now,
    });

    await context.repository.updateStep(submitted.toSnapshot());

    return mapPaymentStep(submitted.toSnapshot());
  };
}
