import type { ModuleRuntime } from "@bedrock/shared/core";

import { DealNotFoundError } from "../../../errors";
import {
  SetAgentBonusInputSchema,
  type SetAgentBonusInput,
} from "../contracts/commands";
import type { DealsCommandUnitOfWork } from "../ports/deals.uow";

export class SetAgentBonusCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly unitOfWork: DealsCommandUnitOfWork,
  ) {}

  async execute(input: SetAgentBonusInput) {
    const validated = SetAgentBonusInputSchema.parse(input);

    return this.unitOfWork.run(async (tx) => {
      const deal = await tx.dealStore.findById(validated.dealId);
      if (!deal) {
        throw new DealNotFoundError(validated.dealId);
      }

      const bonus = await tx.dealStore.insertAgentBonus(validated);

      this.runtime.log.info("Agent bonus set", {
        dealId: validated.dealId,
        agentId: validated.agentId,
        commission: validated.commission,
      });

      return bonus;
    });
  }
}
