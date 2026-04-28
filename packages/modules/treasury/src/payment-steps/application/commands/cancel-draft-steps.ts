import { z } from "zod";

import { loadPaymentStep } from "./shared";
import type { PaymentStepsServiceContext } from "../context";

const CancelDraftPaymentStepsInputSchema = z.object({
  actorUserId: z.string().trim().min(1),
  dealId: z.uuid(),
});

export type CancelDraftPaymentStepsInput = z.infer<
  typeof CancelDraftPaymentStepsInputSchema
>;

export interface CancelDraftPaymentStepsResult {
  cancelledCount: number;
}

export function createCancelDraftPaymentStepsHandler(
  context: PaymentStepsServiceContext,
) {
  return async function cancelDraftPaymentSteps(
    raw: CancelDraftPaymentStepsInput,
  ): Promise<CancelDraftPaymentStepsResult> {
    const input = CancelDraftPaymentStepsInputSchema.parse(raw);
    const now = context.runtime.now();
    let cancelledCount = 0;

    while (true) {
      const drafts = await context.repository.listSteps({
        dealId: input.dealId,
        limit: 100,
        offset: 0,
        purpose: "deal_leg",
        state: ["draft"],
      });

      if (drafts.rows.length === 0) {
        break;
      }

      for (const snapshot of drafts.rows) {
        const aggregate = await loadPaymentStep(context, snapshot.id);
        if (aggregate.toSnapshot().state !== "draft") {
          continue;
        }
        const cancelled = aggregate.cancel(now);
        await context.repository.updateStep(cancelled.toSnapshot());
        cancelledCount += 1;
      }
    }

    return { cancelledCount };
  };
}
