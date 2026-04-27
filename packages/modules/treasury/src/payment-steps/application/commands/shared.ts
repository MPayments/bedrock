import { PaymentStepNotFoundError } from "../../../errors";
import { PaymentStep } from "../../domain/payment-step";
import type { PaymentStepsServiceContext } from "../context";

export async function loadPaymentStep(
  context: PaymentStepsServiceContext,
  stepId: string,
): Promise<PaymentStep> {
  const record = await context.repository.findStepById(stepId);

  if (!record) {
    throw new PaymentStepNotFoundError(stepId);
  }

  return PaymentStep.fromSnapshot(record);
}
