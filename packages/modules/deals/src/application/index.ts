import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { ModuleRuntime } from "@bedrock/shared/core";

import { AttachDealCalculationCommand } from "./commands/attach-deal-calculation";
import { CreateDealCommand } from "./commands/create-deal";
import { TransitionDealStatusCommand } from "./commands/transition-deal-status";
import { UpdateDealIntakeCommand } from "./commands/update-deal-intake";
import type { DealReads } from "./ports/deal.reads";
import type { DealsCommandUnitOfWork } from "./ports/deals.uow";
import type { DealReferencesPort } from "./ports/references.port";
import { FindDealByIdQuery } from "./queries/find-deal-by-id";
import { ListDealCalculationHistoryQuery } from "./queries/list-deal-calculation-history";
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
  const updateDealIntake = new UpdateDealIntakeCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const attachDealCalculation = new AttachDealCalculationCommand(
    deps.runtime,
    deps.commandUow,
    deps.references,
  );
  const transitionDealStatus = new TransitionDealStatusCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findDealById = new FindDealByIdQuery(deps.reads);
  const listCalculationHistory = new ListDealCalculationHistoryQuery(deps.reads);
  const listDeals = new ListDealsQuery(deps.reads);

  return {
    commands: {
      attachCalculation: attachDealCalculation.execute.bind(attachDealCalculation),
      create: createDeal.execute.bind(createDeal),
      transitionStatus: transitionDealStatus.execute.bind(transitionDealStatus),
      updateIntake: updateDealIntake.execute.bind(updateDealIntake),
    },
    queries: {
      findById: findDealById.execute.bind(findDealById),
      listCalculationHistory: listCalculationHistory.execute.bind(
        listCalculationHistory,
      ),
      list: listDeals.execute.bind(listDeals),
    },
  };
}

export type DealsService = ReturnType<typeof createDealsService>;
