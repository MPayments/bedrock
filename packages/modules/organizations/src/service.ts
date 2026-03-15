import { createCurrenciesService } from "@bedrock/currencies";
import { createLedgerBookAccountsService } from "@bedrock/ledger";
import { createRequisiteProvidersService } from "@bedrock/requisite-providers";

import {
  createCreateOrganizationHandler,
  createRemoveOrganizationHandler,
  createUpdateOrganizationHandler,
} from "./application/organizations/commands";
import {
  createFindOrganizationByIdHandler,
  createListOrganizationsHandler,
} from "./application/organizations/queries";
import {
  createCreateOrganizationRequisiteHandler,
  createRemoveOrganizationRequisiteHandler,
  createUpdateOrganizationRequisiteHandler,
} from "./application/requisites/commands";
import {
  createFindOrganizationRequisiteByIdHandler,
  createListOrganizationRequisiteOptionsHandler,
  createListOrganizationRequisitesHandler,
} from "./application/requisites/queries";
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
} from "./application/shared/external-ports";
import {
  createDrizzleOrganizationRequisitesCommandRepository,
  createDrizzleOrganizationRequisitesQueryRepository,
} from "./infra/drizzle/repos/organization-requisites-repository";
import {
  createDrizzleOrganizationsCommandRepository,
  createDrizzleOrganizationsQueryRepository,
} from "./infra/drizzle/repos/organizations-repository";

export type OrganizationsService = ReturnType<
  typeof createOrganizationsService
>;

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const currenciesService = createCurrenciesService({ db: deps.db });
  const currencies = deps.currencies ?? {
    async assertCurrencyExists(id) {
      await currenciesService.findById(id);
    },
    async listCodesById(ids) {
      const rows = await Promise.all(
        ids.map(
          async (id) =>
            [id, (await currenciesService.findById(id)).code] as const,
        ),
      );
      return new Map(rows);
    },
  };
  const requisiteProvidersService = createRequisiteProvidersService({
    db: deps.db,
    logger: deps.logger,
  });
  const requisiteProviders = deps.requisiteProviders ?? {
    async assertProviderActive(id) {
      await requisiteProvidersService.assertActive(id);
    },
  };
  const ledgerBindings = deps.ledgerBindings ?? {
    async ensureOrganizationPostingTarget(tx, input) {
      const { bookId } = await deps.ledgerBooks.ensureDefaultOrganizationBook(
        tx,
        {
          organizationId: input.organizationId,
        },
      );
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
    ...deps,
    currencies,
    ledgerBindings,
    requisiteProviders,
    organizations: createDrizzleOrganizationsCommandRepository(deps.db),
    organizationQueries: createDrizzleOrganizationsQueryRepository(deps.db),
    requisites: createDrizzleOrganizationRequisitesCommandRepository(deps.db),
    requisiteQueries: createDrizzleOrganizationRequisitesQueryRepository(
      deps.db,
    ),
  });

  return {
    list: createListOrganizationsHandler(context),
    findById: createFindOrganizationByIdHandler(context),
    create: createCreateOrganizationHandler(context),
    update: createUpdateOrganizationHandler(context),
    remove: createRemoveOrganizationHandler(context),
    requisites: {
      list: createListOrganizationRequisitesHandler(context),
      listOptions: createListOrganizationRequisiteOptionsHandler(context),
      findById: createFindOrganizationRequisiteByIdHandler(context),
      create: createCreateOrganizationRequisiteHandler(context),
      update: createUpdateOrganizationRequisiteHandler(context),
      remove: createRemoveOrganizationRequisiteHandler(context),
      getBinding:
        createGetOrganizationRequisiteAccountingBindingHandler(context),
      upsertBinding:
        createUpsertOrganizationRequisiteAccountingBindingHandler(context),
      resolveBindings:
        createResolveOrganizationRequisiteBindingsHandler(context),
    },
  };
}
