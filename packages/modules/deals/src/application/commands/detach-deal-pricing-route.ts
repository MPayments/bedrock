import { z } from "zod";

import {
  DealNotFoundError,
  DealPricingContextRevisionConflictError,
} from "../../errors";
import type { DealPricingContext } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import { detachDealPricingRouteSnapshot } from "../shared/pricing-context";

const DetachDealPricingRouteCommandInputSchema = z.object({
  dealId: z.uuid(),
});

type DetachDealPricingRouteCommandInput = z.infer<
  typeof DetachDealPricingRouteCommandInputSchema
>;

export class DetachDealPricingRouteCommand {
  constructor(private readonly commandUow: DealsCommandUnitOfWork) {}

  async execute(
    raw: DetachDealPricingRouteCommandInput,
  ): Promise<DealPricingContext> {
    const validated = DetachDealPricingRouteCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const deal = await tx.dealReads.findById(validated.dealId);

      if (!deal) {
        throw new DealNotFoundError(validated.dealId);
      }

      const existing = await tx.dealReads.findPricingContextByDealId(
        validated.dealId,
      );
      const nextSnapshot = detachDealPricingRouteSnapshot(existing);
      const replaced = await tx.dealStore.replaceDealPricingContext({
        dealId: validated.dealId,
        expectedRevision: existing.revision,
        nextRevision: existing.revision + 1,
        snapshot: nextSnapshot,
      });

      if (!replaced) {
        throw new DealPricingContextRevisionConflictError(
          validated.dealId,
          existing.revision,
        );
      }

      return tx.dealReads.findPricingContextByDealId(validated.dealId);
    });
  }
}
