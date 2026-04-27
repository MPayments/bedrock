import { PaymentStepConflictError } from "../../../errors";
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
    const id = input.id ?? context.runtime.generateUuid();
    const sourceRef =
      input.sourceRef ??
      (input.purpose === "deal_leg"
        ? `deal:${input.dealId ?? "unknown"}:plan-leg:${
            input.origin?.planLegId ?? input.planLegId ?? id
          }:${input.kind}:1`
        : `${input.purpose}:${id}`);
    const created = PaymentStep.create(
      {
        dealId: input.dealId,
        fromAmountMinor: input.fromAmountMinor,
        fromCurrencyId: input.fromCurrencyId,
        fromParty: input.fromParty,
        id,
        kind: input.kind,
        origin: input.origin,
        planLegId: input.planLegId,
        purpose: input.purpose,
        quoteId: input.quoteId,
        rate: input.rate,
        routeSnapshotLegId: input.routeSnapshotLegId,
        sequence: input.sequence,
        sourceRef,
        toAmountMinor: input.toAmountMinor,
        toCurrencyId: input.toCurrencyId,
        toParty: input.toParty,
        treasuryBatchId: input.treasuryBatchId,
        treasuryOrderId: input.treasuryOrderId,
      },
      now,
    );
    const step =
      input.initialState === "pending" ? created.markPending(now) : created;

    const inserted = await context.repository.insertStep(step.toSnapshot());
    if (!inserted) {
      throw new PaymentStepConflictError(sourceRef);
    }

    return mapPaymentStep(inserted);
  };
}
