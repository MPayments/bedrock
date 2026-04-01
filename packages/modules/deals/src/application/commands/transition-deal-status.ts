import { z } from "zod";

import type { ModuleRuntime } from "@bedrock/shared/core";

import { canTransitionDealStatus } from "../../domain/constants";
import {
  DealNotFoundError,
  DealStatusTransitionError,
} from "../../errors";
import {
  TransitionDealStatusInputSchema,
  type TransitionDealStatusInput,
} from "../contracts/commands";
import type { DealDetails } from "../contracts/dto";
import { createTimelinePayloadEvent, deriveDealRootState } from "../shared/workflow-state";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";
import type { DealReferencesPort } from "../ports/references.port";

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
    private readonly references: DealReferencesPort,
  ) {}

  async execute(raw: TransitionDealStatusCommandInput): Promise<DealDetails> {
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

      if (existing.summary.status !== validated.status) {
        const rootState = await deriveDealRootState({
          acceptance: existing.acceptedQuote,
          calculationId: existing.summary.calculationId,
          intake: existing.intake,
          references: this.references,
          status: validated.status,
        });

        await tx.dealStore.setDealRoot({
          dealId: validated.dealId,
          nextAction: rootState.nextAction,
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
      }

      const updated = await tx.dealReads.findById(validated.dealId);
      if (!updated) {
        throw new DealNotFoundError(validated.dealId);
      }

      return updated;
    });
  }
}
