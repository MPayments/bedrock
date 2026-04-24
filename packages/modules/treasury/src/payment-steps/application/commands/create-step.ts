import { PaymentStep } from "../../domain/payment-step";
import type { PaymentStepsServiceContext } from "../context";
import {
  CreatePaymentStepInputSchema,
  type CreatePaymentStepInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createCreatePaymentStepHandler(
  context: PaymentStepsServiceContext,
) {
  return async function createPaymentStep(raw: CreatePaymentStepInput) {
    const input = CreatePaymentStepInputSchema.parse(raw);
    const now = context.runtime.now();
    const created = PaymentStep.create(
      {
        dealId: input.dealId,
        dealLegIdx: input.dealLegIdx,
        dealLegRole: input.dealLegRole,
        fromAmountMinor: input.fromAmountMinor,
        fromCurrencyId: input.fromCurrencyId,
        fromParty: input.fromParty,
        id: input.id ?? context.runtime.generateUuid(),
        kind: input.kind,
        purpose: input.purpose,
        rate: input.rate,
        toAmountMinor: input.toAmountMinor,
        toCurrencyId: input.toCurrencyId,
        toParty: input.toParty,
        treasuryBatchId: input.treasuryBatchId,
      },
      now,
    );
    const step =
      input.initialState === "pending" ? created.markPending(now) : created;

    await context.repository.insertStep(step.toSnapshot());

    return mapPaymentStep(step.toSnapshot());
  };
}
