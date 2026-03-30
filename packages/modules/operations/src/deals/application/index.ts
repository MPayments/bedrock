import type { ModuleRuntime } from "@bedrock/shared/core";

import { SetAgentBonusCommand } from "./commands/set-agent-bonus";
import type { DealsCommandUnitOfWork } from "./ports/deals.uow";

export interface DealsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: DealsCommandUnitOfWork;
}

export function createDealsService(deps: DealsServiceDeps) {
  const setAgentBonus = new SetAgentBonusCommand(
    deps.runtime,
    deps.commandUow,
  );

  return {
    commands: {
      setAgentBonus: setAgentBonus.execute.bind(setAgentBonus),
    },
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
