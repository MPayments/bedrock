import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../errors";
import {
  AppendDealTimelineEventInputSchema,
  type AppendDealTimelineEventInput,
} from "../contracts/commands";
import type { DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import {
  buildDealOperationalPositionRows,
  createTimelinePayloadEvent,
} from "../shared/workflow-state";

const AppendDealTimelineEventCommandInputSchema =
  AppendDealTimelineEventInputSchema.extend({
    actorLabel: z.string().trim().max(255).nullable().optional(),
    actorUserId: z.string().trim().min(1).nullable().optional(),
    dealId: z.uuid(),
  });

type AppendDealTimelineEventCommandInput = AppendDealTimelineEventInput & {
  actorLabel?: string | null;
  actorUserId?: string | null;
  dealId: string;
};

export class AppendDealTimelineEventCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: AppendDealTimelineEventCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = AppendDealTimelineEventCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorLabel: validated.actorLabel ?? null,
          actorUserId: validated.actorUserId ?? null,
          dealId: validated.dealId,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: this.runtime.now(),
          payload: validated.payload,
          sourceRef: validated.sourceRef ?? null,
          type: validated.type,
          visibility: validated.visibility,
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
