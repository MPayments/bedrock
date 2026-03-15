import {
  createAssertActiveRequisiteProviderHandler,
  createCreateRequisiteProviderHandler,
  createFindRequisiteProviderByIdHandler,
  createListRequisiteProvidersHandler,
  createRemoveRequisiteProviderHandler,
  createUpdateRequisiteProviderHandler,
} from "./application/providers/commands";
import {
  createRequisiteProvidersServiceContext,
  type RequisiteProvidersServiceDeps,
} from "./application/shared/context";
import { createDrizzleRequisiteProvidersRepository } from "./infra/drizzle/repos/requisite-providers-repository";

export type RequisiteProvidersService = ReturnType<
  typeof createRequisiteProvidersService
>;

export function createRequisiteProvidersService(
  deps: RequisiteProvidersServiceDeps,
) {
  const context = createRequisiteProvidersServiceContext({
    db: deps.db,
    logger: deps.logger,
    providers: createDrizzleRequisiteProvidersRepository(deps.db),
  });

  return {
    list: createListRequisiteProvidersHandler(context),
    findById: createFindRequisiteProviderByIdHandler(context),
    assertActive: createAssertActiveRequisiteProviderHandler(context),
    create: createCreateRequisiteProviderHandler(context),
    update: createUpdateRequisiteProviderHandler(context),
    remove: createRemoveRequisiteProviderHandler(context),
  };
}
