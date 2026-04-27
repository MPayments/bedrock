import { PaymentStep } from "../../domain/payment-step";
import { PaymentStepNotFoundError } from "../../../errors";
import type { PaymentStepsServiceContext } from "../context";
import {
  RecordPaymentStepReturnInputSchema,
  type RecordPaymentStepReturnInput,
} from "../contracts/commands";
import { mapPaymentStep } from "../map-payment-step";

export function createRecordPaymentStepReturnHandler(
  context: PaymentStepsServiceContext,
) {
  return async function recordPaymentStepReturn(
    raw: RecordPaymentStepReturnInput,
  ) {
    const input = RecordPaymentStepReturnInputSchema.parse(raw);
    const record = await context.repository.findStepById(input.stepId);
    if (!record) {
      throw new PaymentStepNotFoundError(input.stepId);
    }

    const returnedAt = input.returnedAt ?? context.runtime.now();
    const updated = PaymentStep.fromSnapshot(record).recordReturn({
      amountMinor: input.amountMinor,
      currencyId: input.currencyId,
      id: input.returnId ?? context.runtime.generateUuid(),
      providerRef: input.providerRef,
      reason: input.reason,
      returnedAt,
    });

    const persisted = await context.repository.updateStep(updated.toSnapshot());
    if (!persisted) {
      throw new PaymentStepNotFoundError(input.stepId);
    }

    return mapPaymentStep(persisted);
  };
}
