import { createCurrenciesService } from "@bedrock/currencies";
import { createRequisiteProvidersService } from "@bedrock/requisite-providers";

import {
  createCreateCounterpartyHandler,
  createRemoveCounterpartyHandler,
  createUpdateCounterpartyHandler,
} from "./application/counterparties/commands";
import {
  createFindCounterpartyByIdHandler,
  createListCounterpartiesHandler,
} from "./application/counterparties/queries";
import {
  createCreateCustomerHandler,
  createRemoveCustomerHandler,
  createUpdateCustomerHandler,
} from "./application/customers/commands";
import {
  createFindCustomerByIdHandler,
  createListCustomersHandler,
} from "./application/customers/queries";
import {
  createCreateCounterpartyGroupHandler,
  createRemoveCounterpartyGroupHandler,
  createUpdateCounterpartyGroupHandler,
} from "./application/groups/commands";
import { createListCounterpartyGroupsHandler } from "./application/groups/queries";
import {
  createCreateCounterpartyRequisiteHandler,
  createRemoveCounterpartyRequisiteHandler,
  createUpdateCounterpartyRequisiteHandler,
} from "./application/requisites/commands";
import {
  createFindCounterpartyRequisiteByIdHandler,
  createListCounterpartyRequisiteOptionsHandler,
  createListCounterpartyRequisitesHandler,
} from "./application/requisites/queries";
import {
  createPartiesServiceContext,
  type PartiesServiceDeps,
} from "./application/shared/context";
import type {
  PartiesCurrenciesPort,
  PartiesRequisiteProvidersPort,
} from "./application/shared/external-ports";
import {
  createDrizzleCounterpartiesCommandRepository,
  createDrizzleCounterpartiesQueryRepository,
} from "./infra/drizzle/repos/counterparties-repository";
import {
  createDrizzleCounterpartyGroupsCommandRepository,
  createDrizzleCounterpartyGroupsQueryRepository,
} from "./infra/drizzle/repos/counterparty-groups-repository";
import {
  createDrizzleCounterpartyRequisitesCommandRepository,
  createDrizzleCounterpartyRequisitesQueryRepository,
} from "./infra/drizzle/repos/counterparty-requisites-repository";
import {
  createDrizzleCustomersCommandRepository,
  createDrizzleCustomersQueryRepository,
} from "./infra/drizzle/repos/customers-repository";

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
    customers: createDrizzleCustomersCommandRepository(deps.db),
    customerQueries: createDrizzleCustomersQueryRepository(deps.db),
    counterparties: createDrizzleCounterpartiesCommandRepository(deps.db),
    counterpartyQueries: createDrizzleCounterpartiesQueryRepository(deps.db),
    groups: createDrizzleCounterpartyGroupsCommandRepository(deps.db),
    groupQueries: createDrizzleCounterpartyGroupsQueryRepository(deps.db),
    requisites: createDrizzleCounterpartyRequisitesCommandRepository(deps.db),
    requisiteQueries: createDrizzleCounterpartyRequisitesQueryRepository(deps.db),
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
