import { loadPaymentStep } from "./shared";
import type { PaymentStepsServiceContext } from "../context";
import {
  AmendPaymentStepInputSchema,
  type AmendPaymentStepInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createAmendPaymentStepHandler(
  context: PaymentStepsServiceContext,
) {
  return async function amendPaymentStep(raw: AmendPaymentStepInput) {
    const input = AmendPaymentStepInputSchema.parse(raw);
    const amended = (await loadPaymentStep(context, input.stepId)).amend(
      {
        fromAmountMinor: input.fromAmountMinor,
        fromCurrencyId: input.fromCurrencyId,
        fromParty: input.fromParty,
        rate: input.rate,
        toAmountMinor: input.toAmountMinor,
        toCurrencyId: input.toCurrencyId,
        toParty: input.toParty,
      },
      context.runtime.now(),
    );

    await context.repository.updateStep(amended.toSnapshot());

    return mapPaymentStep(amended.toSnapshot());
  };
}
