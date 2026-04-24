import { loadPaymentStep } from "./shared";
import type { PaymentStepsServiceContext } from "../context";
import {
  AttachPaymentStepPostingInputSchema,
  type AttachPaymentStepPostingInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createAttachPaymentStepPostingHandler(
  context: PaymentStepsServiceContext,
) {
  return async function attachPaymentStepPosting(
    raw: AttachPaymentStepPostingInput,
  ) {
    const input = AttachPaymentStepPostingInputSchema.parse(raw);
    const updated = (await loadPaymentStep(context, input.stepId)).attachPosting(
      { documentId: input.documentId, kind: input.kind },
      context.runtime.now(),
    );

    await context.repository.updateStep(updated.toSnapshot());

    return mapPaymentStep(updated.toSnapshot());
  };
}
