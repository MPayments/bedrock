import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import {
  DealNotFoundError,
  DealPricingContextRevisionConflictError,
} from "../../errors";
import {
  UpdateDealPricingContextInputSchema,
  type UpdateDealPricingContextInput,
} from "../contracts/commands";
import type { DealPricingContext } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import { applyDealPricingContextPatch } from "../shared/pricing-context";
import { buildDealLegRows } from "../shared/workflow-state";

const UpdateDealPricingContextCommandInputSchema =
  UpdateDealPricingContextInputSchema.extend({
    dealId: z.uuid(),
  });

type UpdateDealPricingContextCommandInput = UpdateDealPricingContextInput & {
  dealId: string;
};

export class UpdateDealPricingContextCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: UpdateDealPricingContextCommandInput,
  ): Promise<DealPricingContext> {
    const validated = UpdateDealPricingContextCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const deal = await tx.dealReads.findById(validated.dealId);

      if (!deal) {
        throw new DealNotFoundError(validated.dealId);
      }

      const existing = await tx.dealReads.findPricingContextByDealId(
        validated.dealId,
      );

      if (existing.revision !== validated.expectedRevision) {
        throw new DealPricingContextRevisionConflictError(
          validated.dealId,
          validated.expectedRevision,
        );
      }

      const nextSnapshot = applyDealPricingContextPatch({
        context: existing,
        patch: validated,
      });
      const replaced = await tx.dealStore.replaceDealPricingContext({
        dealId: validated.dealId,
        expectedRevision: validated.expectedRevision,
        nextRevision: validated.expectedRevision + 1,
        snapshot: nextSnapshot,
      });

      if (!replaced) {
        throw new DealPricingContextRevisionConflictError(
          validated.dealId,
          validated.expectedRevision,
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
