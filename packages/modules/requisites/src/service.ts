import {
  createCreateRequisiteHandler,
  createRemoveRequisiteHandler,
  createUpdateRequisiteHandler,
} from "./application/requisites/commands";
import {
  createCreateRequisiteProviderHandler,
  createRemoveRequisiteProviderHandler,
  createUpdateRequisiteProviderHandler,
} from "./application/providers/commands";
import {
  createFindRequisiteByIdHandler,
  createListRequisiteOptionsHandler,
  createListRequisitesHandler,
} from "./application/requisites/queries";
import {
  createAssertActiveRequisiteProviderHandler,
  createFindRequisiteProviderByIdHandler,
  createListRequisiteProvidersHandler,
} from "./application/providers/queries";
import {
  createRequisitesServiceContext,
  type RequisitesServiceDeps,
} from "./application/shared/context";
import {
  createDrizzleRequisitesCommandRepository,
  createDrizzleRequisitesQueryRepository,
} from "./infra/drizzle/repos/requisites-repository";
import {
  createDrizzleRequisiteProvidersCommandRepository,
  createDrizzleRequisiteProvidersQueryRepository,
} from "./infra/drizzle/repos/requisite-providers-repository";

export type RequisitesService = ReturnType<typeof createRequisitesService>;

export function createRequisitesService(
  deps: RequisitesServiceDeps,
) {
  const context = createRequisitesServiceContext({
    db: deps.db,
    logger: deps.logger,
    now: deps.now,
    currencies: deps.currencies,
    owners: deps.owners,
    organizationBindings: deps.organizationBindings,
    requisiteQueries: createDrizzleRequisitesQueryRepository(deps.db),
    requisiteCommands: createDrizzleRequisitesCommandRepository(deps.db),
    providerQueries: createDrizzleRequisiteProvidersQueryRepository(deps.db),
    providerCommands: createDrizzleRequisiteProvidersCommandRepository(deps.db),
  });

  return {
    list: createListRequisitesHandler(context),
    listOptions: createListRequisiteOptionsHandler(context),
    findById: createFindRequisiteByIdHandler(context),
    create: createCreateRequisiteHandler(context),
    update: createUpdateRequisiteHandler(context),
    remove: createRemoveRequisiteHandler(context),
    providers: {
      list: createListRequisiteProvidersHandler(context),
      findById: createFindRequisiteProviderByIdHandler(context),
      assertActive: createAssertActiveRequisiteProviderHandler(context),
      create: createCreateRequisiteProviderHandler(context),
      update: createUpdateRequisiteProviderHandler(context),
      remove: createRemoveRequisiteProviderHandler(context),
    },
  };
}
