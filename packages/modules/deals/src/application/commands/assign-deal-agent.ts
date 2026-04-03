import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import { DealNotFoundError } from "../../errors";
import { AssignDealAgentInputSchema } from "../contracts/commands";
import { type DealWorkflowProjection } from "../contracts/dto";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import { createTimelinePayloadEvent } from "../shared/workflow-state";

const AssignDealAgentCommandInputSchema = AssignDealAgentInputSchema.extend({
  actorUserId: z.string().trim().min(1),
  id: z.string().uuid(),
});

type AssignDealAgentCommandInput = z.infer<
  typeof AssignDealAgentCommandInputSchema
>;

export class AssignDealAgentCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: DealsCommandUnitOfWork,
  ) {}

  async execute(
    raw: AssignDealAgentCommandInput,
  ): Promise<DealWorkflowProjection> {
    const validated = AssignDealAgentCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findWorkflowById(validated.id);

      if (!existing) {
        throw new DealNotFoundError(validated.id);
      }

      await tx.dealStore.setDealRoot({
        agentId: validated.agentId ?? null,
        dealId: validated.id,
      });
      await tx.dealStore.createDealTimelineEvents([
        createTimelinePayloadEvent({
          actorUserId: validated.actorUserId,
          dealId: validated.id,
          generateUuid: () => this.runtime.generateUuid(),
          occurredAt: this.runtime.now(),
          payload: {
            agentId: validated.agentId ?? null,
          },
          type: "participant_changed",
          visibility: "internal",
        }),
      ]);

      const updated = await tx.dealReads.findWorkflowById(validated.id);

      if (!updated) {
        throw new ValidationError(
          `Deal ${validated.id} disappeared after assignee update`,
        );
      }

      return updated;
    });
  }
}
