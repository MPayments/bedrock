import { createCurrenciesService } from "@bedrock/currencies";
import { createRequisiteProvidersService } from "@bedrock/requisite-providers";

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
  createCreateCounterpartyRequisiteHandler,
  createFindCounterpartyRequisiteByIdHandler,
  createListCounterpartyRequisiteOptionsHandler,
  createListCounterpartyRequisitesHandler,
  createRemoveCounterpartyRequisiteHandler,
  createUpdateCounterpartyRequisiteHandler,
} from "./application/requisites/commands";
import {
  createPartiesServiceContext,
  type PartiesServiceDeps,
} from "./application/shared/context";
import type {
  PartiesCurrenciesPort,
  PartiesRequisiteProvidersPort,
} from "./application/ports";
import { createDrizzlePartiesRepository } from "./infra/drizzle/repos/parties-repository";
import { createDrizzleCounterpartyRequisitesRepository } from "./infra/drizzle/repos/counterparty-requisites-repository";

export type PartiesService = ReturnType<typeof createPartiesService>;

export function createPartiesService(deps: PartiesServiceDeps) {
  const currenciesService = createCurrenciesService({ db: deps.db });
  const currencies: PartiesCurrenciesPort =
    deps.currencies ??
    {
      async assertCurrencyExists(id) {
        await currenciesService.findById(id);
      },
      async listCodesById(ids) {
        const rows = await Promise.all(
          ids.map(async (id) => [id, (await currenciesService.findById(id)).code] as const),
        );
        return new Map(rows);
      },
    };
  const requisiteProvidersService = createRequisiteProvidersService({
    db: deps.db,
    logger: deps.logger,
  });
  const requisiteProviders: PartiesRequisiteProvidersPort =
    deps.requisiteProviders ??
    {
      async assertProviderActive(id) {
        await requisiteProvidersService.assertActive(id);
      },
    };
  const context = createPartiesServiceContext({
    ...deps,
    currencies,
    requisiteProviders,
    parties: createDrizzlePartiesRepository(deps.db),
    requisites: createDrizzleCounterpartyRequisitesRepository(deps.db),
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
    requisites: {
      list: createListCounterpartyRequisitesHandler(context),
      listOptions: createListCounterpartyRequisiteOptionsHandler(context),
      findById: createFindCounterpartyRequisiteByIdHandler(context),
      create: createCreateCounterpartyRequisiteHandler(context),
      update: createUpdateCounterpartyRequisiteHandler(context),
      remove: createRemoveCounterpartyRequisiteHandler(context),
    },
  };
}
