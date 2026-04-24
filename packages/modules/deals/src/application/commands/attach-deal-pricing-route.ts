import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  DealNotFoundError,
  DealPricingContextRevisionConflictError,
} from "../../errors";
import {
  AttachDealPricingRouteInputSchema,
  type AttachDealPricingRouteInput,
} from "../contracts/commands";
import type { DealPricingContext } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import { attachDealPricingRouteSnapshot } from "../shared/pricing-context";
import { buildDealLegRows } from "../shared/workflow-state";

const AttachDealPricingRouteCommandInputSchema =
  AttachDealPricingRouteInputSchema.extend({
    dealId: z.uuid(),
  });

type AttachDealPricingRouteCommandInput = AttachDealPricingRouteInput & {
  dealId: string;
};

export class AttachDealPricingRouteCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: AttachDealPricingRouteCommandInput,
  ): Promise<DealPricingContext> {
    const validated = AttachDealPricingRouteCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const deal = await tx.dealReads.findById(validated.dealId);

      if (!deal) {
        throw new DealNotFoundError(validated.dealId);
      }

      const existing = await tx.dealReads.findPricingContextByDealId(
        validated.dealId,
      );
      const nextSnapshot = attachDealPricingRouteSnapshot({
        context: existing,
        now: this.runtime.now(),
        route: validated,
      });
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
            routeSnapshot: nextSnapshot.routeAttachment?.snapshot ?? null,
          }),
        });
      }

      return tx.dealReads.findPricingContextByDealId(validated.dealId);
    });
  }
}
