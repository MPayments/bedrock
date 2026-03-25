import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateDealCommand } from "./commands/create-deal";
import { SetAgentBonusCommand } from "./commands/set-agent-bonus";
import { UpdateDealDetailsCommand } from "./commands/update-deal-details";
import { UpdateDealStatusCommand } from "./commands/update-deal-status";
import type { DealReads } from "./ports/deal.reads";
import type { DealsCommandUnitOfWork } from "./ports/deals.uow";
import { FindDealByIdQuery } from "./queries/find-deal-by-id";
import { ListDealsQuery } from "./queries/list-deals";

export interface DealsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: DealsCommandUnitOfWork;
  reads: DealReads;
}

export function createDealsService(deps: DealsServiceDeps) {
  const createDeal = new CreateDealCommand(deps.runtime, deps.commandUow);
  const updateStatus = new UpdateDealStatusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateDetails = new UpdateDealDetailsCommand(
    deps.runtime,
    deps.commandUow,
  );
  const setAgentBonus = new SetAgentBonusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findById = new FindDealByIdQuery(deps.reads);
  const listDeals = new ListDealsQuery(deps.reads);

  return {
    commands: {
      create: createDeal.execute.bind(createDeal),
      updateStatus: updateStatus.execute.bind(updateStatus),
      updateDetails: updateDetails.execute.bind(updateDetails),
      setAgentBonus: setAgentBonus.execute.bind(setAgentBonus),
    },
    queries: {
      findById: findById.execute.bind(findById),
      findByIdWithDetails: deps.reads.findByIdWithDetails.bind(deps.reads),
      list: listDeals.execute.bind(listDeals),
      listDocuments: deps.reads.listDocuments.bind(deps.reads),
      getLatestBonusForDeal: deps.reads.getLatestBonusForDeal.bind(deps.reads),
    },
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
