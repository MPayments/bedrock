import {
  createCreateCounterpartyHandler,
  createFindCounterpartyByIdHandler,
  createListCounterpartiesHandler,
  createRemoveCounterpartyHandler,
  createUpdateCounterpartyHandler,
} from "./application/counterparties/commands";
import {
  createCreateCustomerHandler,
  createFindCustomerByIdHandler,
  createListCustomersHandler,
  createRemoveCustomerHandler,
  createUpdateCustomerHandler,
} from "./application/customers/commands";
import {
  createCreateCounterpartyGroupHandler,
  createListCounterpartyGroupsHandler,
  createRemoveCounterpartyGroupHandler,
  createUpdateCounterpartyGroupHandler,
} from "./application/groups/commands";
import {
  createPartiesServiceContext,
  type PartiesServiceDeps,
} from "./application/shared/context";
import { createDrizzlePartiesRepository } from "./infra/drizzle/repos/parties-repository";

export type PartiesService = ReturnType<typeof createPartiesService>;

export function createPartiesService(deps: PartiesServiceDeps) {
  const context = createPartiesServiceContext({
    ...deps,
    parties: createDrizzlePartiesRepository(deps.db),
  });

  return {
    customers: {
      list: createListCustomersHandler(context),
      findById: createFindCustomerByIdHandler(context),
      create: createCreateCustomerHandler(context),
      update: createUpdateCustomerHandler(context),
      remove: createRemoveCustomerHandler(context),
    },
    counterparties: {
      list: createListCounterpartiesHandler(context),
      findById: createFindCounterpartyByIdHandler(context),
      create: createCreateCounterpartyHandler(context),
      update: createUpdateCounterpartyHandler(context),
      remove: createRemoveCounterpartyHandler(context),
    },
    groups: {
      list: createListCounterpartyGroupsHandler(context),
      create: createCreateCounterpartyGroupHandler(context),
      update: createUpdateCounterpartyGroupHandler(context),
      remove: createRemoveCounterpartyGroupHandler(context),
    },
  };
}
