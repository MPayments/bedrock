import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import { canTransitionDealLegState } from "../../domain/constants";
import {
  DealLegStateTransitionError,
  DealNotFoundError,
} from "../../errors";
import {
  UpdateDealLegStateInputSchema,
  type UpdateDealLegStateInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
} from "../shared/workflow-state";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

const UpdateDealLegStateCommandInputSchema = UpdateDealLegStateInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  dealId: z.uuid(),
  idx: z.number().int().positive(),
});

type UpdateDealLegStateCommandInput = UpdateDealLegStateInput & {
  actorUserId: string;
  dealId: string;
  idx: number;
};

export class UpdateDealLegStateCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: UpdateDealLegStateCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = UpdateDealLegStateCommandInputSchema.parse(raw);

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

      if (leg.state === validated.state) {
        return existing;
      }

      if (!canTransitionDealLegState(leg.state, validated.state)) {
        throw new DealLegStateTransitionError(
          validated.idx,
          leg.state,
          validated.state,
        );
      }

      const updatedLeg = await tx.dealStore.updateDealLegState({
        dealId: validated.dealId,
        idx: validated.idx,
        state: validated.state,
      });
      if (!updatedLeg) {
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
            state: validated.state,
          },
          type: "leg_state_changed",
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
      await tx.dealStore.replaceDealOperationalPositions({
        dealId: validated.dealId,
        positions: buildDealOperationalPositionRows({
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          operationalState: updated.operationalState,
        }),
      });

      return updated;
    });
  }
}
