import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import {
  RejectDealInputSchema,
  type RejectDealInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
} from "../shared/workflow-state";

const RejectDealCommandInputSchema = RejectDealInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  dealId: z.uuid(),
});

type RejectDealCommandInput = RejectDealInput & {
  actorUserId: string;
  dealId: string;
};

function approvalTypeFromScope(scope: "customer" | "internal") {
  return scope === "customer" ? "commercial" : "operations";
}

export class RejectDealCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: RejectDealCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = RejectDealCommandInputSchema.parse(raw);
    const now = this.runtime.now();

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);

      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.createDealApprovals([
        {
          approvalType: approvalTypeFromScope(validated.scope),
          comment: validated.reason ?? null,
          dealId: validated.dealId,
          decidedAt: now,
          decidedBy: validated.actorUserId,
          id: this.runtime.generateUuid(),
          requestedAt: now,
          requestedBy: validated.actorUserId,
          status: "rejected",
        },
      ]);
      await tx.dealStore.setDealRoot({
        dealId: validated.dealId,
        nextAction: "No action",
        status: "rejected",
      });
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: now,
          payload: {
            reason: validated.reason ?? null,
            scope: validated.scope,
            status: "rejected",
          },
          sourceRef: `deal-approval:${validated.scope}:rejected`,
          type: "deal_rejected",
          visibility: validated.scope === "customer" ? "customer_safe" : "internal",
        }),
      ]);

      const updated = await tx.dealReads.findWorkflowById(validated.dealId);

      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

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
