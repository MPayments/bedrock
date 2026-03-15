import {
  createCreateOrganizationHandler,
  createFindOrganizationByIdHandler,
  createListOrganizationsHandler,
  createRemoveOrganizationHandler,
  createUpdateOrganizationHandler,
} from "./application/organizations/commands";
import {
  createOrganizationsServiceContext,
  type OrganizationsServiceDeps,
} from "./application/shared/context";
import { createDrizzleOrganizationsRepository } from "./infra/drizzle/repos/organizations-repository";

export type OrganizationsService = ReturnType<
  typeof createOrganizationsService
>;

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const context = createOrganizationsServiceContext({
    db: deps.db,
    logger: deps.logger,
    ledgerBooks: deps.ledgerBooks,
    organizations: createDrizzleOrganizationsRepository(deps.db),
  });

  const list = createListOrganizationsHandler(context);
  const findById = createFindOrganizationByIdHandler(context);
  const create = createCreateOrganizationHandler(context);
  const update = createUpdateOrganizationHandler(context);
  const remove = createRemoveOrganizationHandler(context);

  return {
    list,
    findById,
    create,
    update,
    remove,
  };
}
