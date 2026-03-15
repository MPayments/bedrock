import {
  createGetRequisiteAccountingBindingHandler,
  createResolveRequisiteBindingsHandler,
  createUpsertRequisiteAccountingBindingHandler,
} from "./application/bindings/commands";
import {
  createCreateRequisiteProviderHandler,
  createFindRequisiteProviderByIdHandler,
  createListRequisiteProvidersHandler,
  createRemoveRequisiteProviderHandler,
  createUpdateRequisiteProviderHandler,
} from "./application/providers/commands";
import {
  createCreateRequisiteHandler,
  createFindRequisiteByIdHandler,
  createListRequisiteOptionsHandler,
  createListRequisitesHandler,
  createRemoveRequisiteHandler,
  createUpdateRequisiteHandler,
} from "./application/requisites/commands";
import {
  createRequisitesServiceContext,
  type RequisitesServiceDeps,
} from "./application/shared/context";
import {
  createDrizzleRequisitesCurrenciesPort,
  createDrizzleRequisitesOwnersPort,
  createLedgerRequisitesBindingsPort,
} from "./infra/drizzle/adapters/foreign-ports";
import { createDrizzleRequisitesRepository } from "./infra/drizzle/repos/requisites-repository";

export type RequisitesService = ReturnType<typeof createRequisitesService>;

export function createRequisitesService(deps: RequisitesServiceDeps) {
  const context = createRequisitesServiceContext({
    db: deps.db,
    logger: deps.logger,
    owners: deps.owners ?? createDrizzleRequisitesOwnersPort({ db: deps.db }),
    currencies:
      deps.currencies ?? createDrizzleRequisitesCurrenciesPort({ db: deps.db }),
    ledgerBindings:
      deps.ledgerBindings ?? createLedgerRequisitesBindingsPort(),
    requisites: createDrizzleRequisitesRepository(deps.db),
  });

  return {
    requisites: {
      list: createListRequisitesHandler(context),
      findById: createFindRequisiteByIdHandler(context),
      create: createCreateRequisiteHandler(context),
      update: createUpdateRequisiteHandler(context),
      remove: createRemoveRequisiteHandler(context),
      listOptions: createListRequisiteOptionsHandler(context),
      getBinding: createGetRequisiteAccountingBindingHandler(context),
      upsertBinding: createUpsertRequisiteAccountingBindingHandler(context),
      resolveBindings: createResolveRequisiteBindingsHandler(context),
    },
    providers: {
      list: createListRequisiteProvidersHandler(context),
      findById: createFindRequisiteProviderByIdHandler(context),
      create: createCreateRequisiteProviderHandler(context),
      update: createUpdateRequisiteProviderHandler(context),
      remove: createRemoveRequisiteProviderHandler(context),
    },
  };
}
