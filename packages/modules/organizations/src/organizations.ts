import { createCurrenciesService } from "@bedrock/currencies";
import { createLedgerBookAccountsService } from "@bedrock/ledger";
import { createRequisiteProvidersService } from "@bedrock/requisite-providers";

import {
  createCreateOrganizationHandler,
  createFindOrganizationByIdHandler,
  createListOrganizationsHandler,
  createRemoveOrganizationHandler,
  createUpdateOrganizationHandler,
} from "./application/organizations/commands";
import {
  createCreateOrganizationRequisiteHandler,
  createFindOrganizationRequisiteByIdHandler,
  createListOrganizationRequisiteOptionsHandler,
  createListOrganizationRequisitesHandler,
  createRemoveOrganizationRequisiteHandler,
  createUpdateOrganizationRequisiteHandler,
} from "./application/requisites/commands";
import {
  createGetOrganizationRequisiteAccountingBindingHandler,
  createResolveOrganizationRequisiteBindingsHandler,
  createUpsertOrganizationRequisiteAccountingBindingHandler,
} from "./application/requisites/bindings";
import {
  createOrganizationsServiceContext,
  type OrganizationsServiceDeps,
} from "./application/shared/context";
import type {
  OrganizationsCurrenciesPort,
  OrganizationsRequisiteProvidersPort,
} from "./application/ports";
import { createDrizzleOrganizationsRepository } from "./infra/drizzle/repos/organizations-repository";
import { createDrizzleOrganizationRequisitesRepository } from "./infra/drizzle/repos/organization-requisites-repository";

export type OrganizationsService = ReturnType<
  typeof createOrganizationsService
>;

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const currenciesService = createCurrenciesService({ db: deps.db });
  const currencies: OrganizationsCurrenciesPort =
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
  const requisiteProviders: OrganizationsRequisiteProvidersPort =
    deps.requisiteProviders ??
    {
      async assertProviderActive(id) {
        await requisiteProvidersService.assertActive(id);
      },
    };
  const ledgerBindings =
    deps.ledgerBindings ??
    {
      async ensureOrganizationPostingTarget(tx, input) {
        const { bookId } = await deps.ledgerBooks.ensureDefaultOrganizationBook(tx, {
          organizationId: input.organizationId,
        });
        const bookAccounts = createLedgerBookAccountsService({ db: tx });
        const bookAccount = await bookAccounts.ensureBookAccountInstance({
          bookId,
          accountNo: input.postingAccountNo,
          currency: input.currencyCode,
          dimensions: {},
        });

        return {
          bookId,
          bookAccountInstanceId: bookAccount.id,
        };
      },
    };
  const context = createOrganizationsServiceContext({
    db: deps.db,
    logger: deps.logger,
    ledgerBooks: deps.ledgerBooks,
    currencies,
    ledgerBindings,
    requisiteProviders,
    organizations: createDrizzleOrganizationsRepository(deps.db),
    requisites: createDrizzleOrganizationRequisitesRepository(deps.db),
  });

  const list = createListOrganizationsHandler(context);
  const findById = createFindOrganizationByIdHandler(context);
  const create = createCreateOrganizationHandler(context);
  const update = createUpdateOrganizationHandler(context);
  const remove = createRemoveOrganizationHandler(context);
  const listRequisites = createListOrganizationRequisitesHandler(context);
  const listRequisiteOptions = createListOrganizationRequisiteOptionsHandler(context);
  const findRequisiteById = createFindOrganizationRequisiteByIdHandler(context);
  const createRequisite = createCreateOrganizationRequisiteHandler(context);
  const updateRequisite = createUpdateOrganizationRequisiteHandler(context);
  const removeRequisite = createRemoveOrganizationRequisiteHandler(context);
  const getBinding = createGetOrganizationRequisiteAccountingBindingHandler(context);
  const upsertBinding =
    createUpsertOrganizationRequisiteAccountingBindingHandler(context);
  const resolveBindings = createResolveOrganizationRequisiteBindingsHandler(context);

  return {
    list,
    findById,
    create,
    update,
    remove,
    requisites: {
      list: listRequisites,
      listOptions: listRequisiteOptions,
      findById: findRequisiteById,
      create: createRequisite,
      update: updateRequisite,
      remove: removeRequisite,
      getBinding,
      upsertBinding,
      resolveBindings,
    },
  };
}
