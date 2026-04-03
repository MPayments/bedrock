import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateCounterpartyCommand } from "./commands/create-counterparty";
import { CreateCounterpartyGroupCommand } from "./commands/create-counterparty-group";
import { RemoveCounterpartyCommand } from "./commands/remove-counterparty";
import { RemoveCounterpartyGroupCommand } from "./commands/remove-counterparty-group";
import { UpdateCounterpartyCommand } from "./commands/update-counterparty";
import { UpdateCounterpartyGroupCommand } from "./commands/update-counterparty-group";
import type { CounterpartiesCommandUnitOfWork } from "./ports/counterparties.uow";
import type { CounterpartyGroupReads } from "./ports/counterparty-group.reads";
import type { CounterpartyReads } from "./ports/counterparty.reads";
import { FindCounterpartyByIdQuery } from "./queries/find-counterparty-by-id";
import { ListCounterpartiesQuery } from "./queries/list-counterparties";
import { ListCounterpartyGroupsQuery } from "./queries/list-counterparty-groups";

export interface CounterpartiesServiceDeps {
  commandUow: CounterpartiesCommandUnitOfWork;
  runtime: ModuleRuntime;
  reads: CounterpartyReads;
  groupReads: CounterpartyGroupReads;
}

export function createCounterpartiesService(deps: CounterpartiesServiceDeps) {
  const createCounterparty = new CreateCounterpartyCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateCounterparty = new UpdateCounterpartyCommand(
    deps.runtime,
    deps.commandUow,
  );
  const removeCounterparty = new RemoveCounterpartyCommand(
    deps.runtime,
    deps.commandUow,
  );
  const createCounterpartyGroup = new CreateCounterpartyGroupCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateCounterpartyGroup = new UpdateCounterpartyGroupCommand(
    deps.runtime,
    deps.commandUow,
  );
  const removeCounterpartyGroup = new RemoveCounterpartyGroupCommand(
    deps.runtime,
    deps.commandUow,
  );
  const listCounterparties = new ListCounterpartiesQuery(deps.reads);
  const findCounterpartyById = new FindCounterpartyByIdQuery(deps.reads);
  const listCounterpartyGroups = new ListCounterpartyGroupsQuery(
    deps.groupReads,
  );

  return {
    commands: {
      create: createCounterparty.execute.bind(createCounterparty),
      update: updateCounterparty.execute.bind(updateCounterparty),
      remove: removeCounterparty.execute.bind(removeCounterparty),
      createGroup: createCounterpartyGroup.execute.bind(
        createCounterpartyGroup,
      ),
      updateGroup: updateCounterpartyGroup.execute.bind(
        updateCounterpartyGroup,
      ),
      removeGroup: removeCounterpartyGroup.execute.bind(
        removeCounterpartyGroup,
      ),
    },
    queries: {
      list: listCounterparties.execute.bind(listCounterparties),
      findById: findCounterpartyById.execute.bind(findCounterpartyById),
      listGroups: listCounterpartyGroups.execute.bind(listCounterpartyGroups),
    },
  };
}

export type CounterpartiesService = ReturnType<
  typeof createCounterpartiesService
>;
