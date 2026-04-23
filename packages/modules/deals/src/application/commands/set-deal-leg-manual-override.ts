import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import { DealNotFoundError } from "../../errors";
import {
  SetDealLegManualOverrideInputSchema,
  type SetDealLegManualOverrideInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import { createTimelinePayloadEvent } from "../shared/workflow-state";

const SetDealLegManualOverrideCommandInputSchema =
  SetDealLegManualOverrideInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
    idx: z.number().int().positive(),
  });

type SetDealLegManualOverrideCommandInput = SetDealLegManualOverrideInput & {
  actorUserId: string;
  dealId: string;
  idx: number;
};

export class SetDealLegManualOverrideCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    input: SetDealLegManualOverrideCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = SetDealLegManualOverrideCommandInputSchema.parse(input);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      const leg = existing.executionPlan.find(
        (candidate) => candidate.idx === validated.idx,
      );
      if (!leg) {
        throw new ValidationError(
          `Deal ${validated.dealId} does not have leg ${validated.idx}`,
        );
      }

      const wrote = await tx.dealStore.setDealLegManualOverride({
        dealId: validated.dealId,
        idx: validated.idx,
        manualOverrideState: validated.override,
        reasonCode: validated.reasonCode ?? null,
        comment: validated.comment ?? null,
      });
      if (!wrote) {
        throw new ValidationError(
          `Deal ${validated.dealId} does not have stored leg ${validated.idx}`,
        );
      }

      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: this.runtime.now(),
          payload: {
            comment: validated.comment ?? null,
            fromState: leg.state,
            idx: leg.idx,
            kind: leg.kind,
            override: validated.override,
            reasonCode: validated.reasonCode ?? null,
          },
          type:
            validated.override === null
              ? "leg_manual_override_cleared"
              : "leg_manual_override_set",
          visibility: "internal",
        }),
      ]);

      const updated = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        nextAction: updated.nextAction,
      });

      return updated;
    });
  }
}
