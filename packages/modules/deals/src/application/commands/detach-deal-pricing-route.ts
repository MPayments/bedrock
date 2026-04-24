import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  DealNotFoundError,
  DealPricingContextRevisionConflictError,
} from "../../errors";
import type { DealPricingContext } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import { detachDealPricingRouteSnapshot } from "../shared/pricing-context";
import { buildDealLegRows } from "../shared/workflow-state";

const DetachDealPricingRouteCommandInputSchema = z.object({
  dealId: z.uuid(),
});

type DetachDealPricingRouteCommandInput = z.infer<
  typeof DetachDealPricingRouteCommandInputSchema
>;

export class DetachDealPricingRouteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

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

      const workflow = await tx.dealReads.findWorkflowById(validated.dealId);
      if (workflow) {
        await tx.dealStore.replaceDealLegs({
          dealId: validated.dealId,
          legs: buildDealLegRows({
            dealId: validated.dealId,
            existingLegs: workflow.executionPlan,
            generateUuid: () => this.runtime.generateUuid(),
            intake: workflow.intake,
            routeSnapshot: null,
          }),
        });
      }

      return tx.dealReads.findPricingContextByDealId(validated.dealId);
    });
  }
}
