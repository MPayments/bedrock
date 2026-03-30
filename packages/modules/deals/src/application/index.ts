import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateDealCommand } from "./commands/create-deal";
import type { DealReads } from "./ports/deal.reads";
import type { DealsCommandUnitOfWork } from "./ports/deals.uow";
import type { DealReferencesPort } from "./ports/references.port";
import { FindDealByIdQuery } from "./queries/find-deal-by-id";
import { ListDealsQuery } from "./queries/list-deals";

export interface DealsServiceDeps {
  commandUow: DealsCommandUnitOfWork;
  idempotency: IdempotencyPort;
  reads: DealReads;
  references: DealReferencesPort;
  runtime: ModuleRuntime;
}

export function createDealsService(deps: DealsServiceDeps) {
  const createDeal = new CreateDealCommand(
    deps.runtime,
    deps.commandUow,
    deps.idempotency,
    deps.references,
  );
  const findDealById = new FindDealByIdQuery(deps.reads);
  const listDeals = new ListDealsQuery(deps.reads);

  return {
    commands: {
      create: createDeal.execute.bind(createDeal),
    },
    queries: {
      findById: findDealById.execute.bind(findDealById),
      list: listDeals.execute.bind(listDeals),
    },
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
