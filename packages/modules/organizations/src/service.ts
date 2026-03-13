import { createCreateOrganizationHandler } from "./commands/create-organization";
import { createFindOrganizationByIdHandler } from "./commands/find-organization-by-id";
import { createListOrganizationsHandler } from "./commands/list-organizations";
import { createRemoveOrganizationHandler } from "./commands/remove-organization";
import { createUpdateOrganizationHandler } from "./commands/update-organization";
import {
  createOrganizationsServiceContext,
  type OrganizationsServiceDeps,
} from "./internal/context";

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const context = createOrganizationsServiceContext(deps);

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
