import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { canTransitionDealStatus } from "../../domain/constants";
import {
  DealNotFoundError,
  DealTransitionBlockedError,
  DealStatusTransitionError,
} from "../../errors";
import {
  TransitionDealStatusInputSchema,
  type TransitionDealStatusInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
} from "../shared/workflow-state";

const TransitionDealStatusCommandInputSchema =
  TransitionDealStatusInputSchema.extend({
    actorUserId: z.string().trim().min(1),
    dealId: z.uuid(),
  });

type TransitionDealStatusCommandInput = TransitionDealStatusInput & {
  actorUserId: string;
  dealId: string;
};

export class TransitionDealStatusCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: TransitionDealStatusCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = TransitionDealStatusCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      if (!canTransitionDealStatus(existing.summary.status, validated.status)) {
        throw new DealStatusTransitionError(
          existing.summary.status,
          validated.status,
        );
      }

      const readiness = existing.transitionReadiness.find(
        (candidate) => candidate.targetStatus === validated.status,
      );
      if (readiness && !readiness.allowed) {
        throw new DealTransitionBlockedError(validated.status, readiness.blockers);
      }

      if (existing.summary.status === validated.status) {
        return existing;
      }

      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        status: validated.status,
      });
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: this.runtime.now(),
          payload: {
            comment: validated.comment ?? null,
            status: validated.status,
          },
          type: "status_changed",
          visibility: "customer_safe",
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
