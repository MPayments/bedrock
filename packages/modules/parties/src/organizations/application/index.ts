import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateOrganizationCommand } from "./commands/create-organization";
import { RemoveOrganizationCommand } from "./commands/remove-organization";
import { UpdateOrganizationCommand } from "./commands/update-organization";
import type { OrganizationReads } from "./ports/organization.reads";
import type { OrganizationsCommandUnitOfWork } from "./ports/organizations.uow";
import { FindOrganizationByIdQuery } from "./queries/find-organization-by-id";
import { ListOrganizationsQuery } from "./queries/list-organizations";

export interface OrganizationsServiceDeps {
  commandUow: OrganizationsCommandUnitOfWork;
  runtime: ModuleRuntime;
  reads: OrganizationReads;
}

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const createOrganization = new CreateOrganizationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateOrganization = new UpdateOrganizationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const removeOrganization = new RemoveOrganizationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const listOrganizations = new ListOrganizationsQuery(deps.reads);
  const findOrganizationById = new FindOrganizationByIdQuery(deps.reads);

  return {
    commands: {
      create: createOrganization.execute.bind(createOrganization),
      update: updateOrganization.execute.bind(updateOrganization),
      remove: removeOrganization.execute.bind(removeOrganization),
    },
    queries: {
      list: listOrganizations.execute.bind(listOrganizations),
      findById: findOrganizationById.execute.bind(findOrganizationById),
    },
  };
}

export type OrganizationsService = ReturnType<typeof createOrganizationsService>;
