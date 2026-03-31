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
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

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

  async execute(raw: TransitionDealStatusCommandInput): Promise<DealDetails> {
    const validated = TransitionDealStatusCommandInputSchema.parse(raw);

    return this.commandUow.run(async (tx) => {
      const existing = await tx.dealReads.findById(validated.dealId);
      if (!existing) {
        throw new DealNotFoundError(validated.dealId);
      }

      if (!canTransitionDealStatus(existing.status, validated.status)) {
        throw new DealStatusTransitionError(existing.status, validated.status);
      }

      if (existing.status !== validated.status) {
        await tx.dealStore.updateDealRoot({
          dealId: validated.dealId,
          status: validated.status,
        });
        await tx.dealStore.createDealStatusHistory([
          {
            id: this.runtime.generateUuid(),
            dealId: validated.dealId,
            status: validated.status,
            changedBy: validated.actorUserId,
            comment: validated.comment ?? null,
          },
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
