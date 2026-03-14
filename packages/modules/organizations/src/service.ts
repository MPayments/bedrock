import {
  createCreateOrganizationHandler,
} from "./application/organizations/commands/create-organization";
import {
  createFindOrganizationByIdHandler,
} from "./application/organizations/commands/find-organization-by-id";
import {
  createListOrganizationsHandler,
} from "./application/organizations/commands/list-organizations";
import {
  createRemoveOrganizationHandler,
} from "./application/organizations/commands/remove-organization";
import {
  createUpdateOrganizationHandler,
} from "./application/organizations/commands/update-organization";
import {
  createOrganizationsServiceContext,
  type OrganizationsServiceDeps,
} from "./application/shared/context";
import { createDrizzleOrganizationsRepository } from "./infra/drizzle/repos/organizations-repository";

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;

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
