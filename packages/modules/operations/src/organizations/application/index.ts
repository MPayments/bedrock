import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateOrganizationCommand } from "./commands/create-organization";
import { RestoreOrganizationCommand } from "./commands/restore-organization";
import { SoftDeleteOrganizationCommand } from "./commands/soft-delete-organization";
import { UpdateOrganizationCommand } from "./commands/update-organization";
import type { OrganizationReads } from "./ports/organization.reads";
import type { OrganizationsCommandUnitOfWork } from "./ports/organizations.uow";
import { FindOrganizationByIdQuery } from "./queries/find-organization-by-id";
import { ListOrganizationsQuery } from "./queries/list-organizations";

export interface OrganizationsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: OrganizationsCommandUnitOfWork;
  reads: OrganizationReads;
}

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const createOrg = new CreateOrganizationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateOrg = new UpdateOrganizationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const softDeleteOrg = new SoftDeleteOrganizationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const restoreOrg = new RestoreOrganizationCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findOrgById = new FindOrganizationByIdQuery(deps.reads);
  const listOrgs = new ListOrganizationsQuery(deps.reads);

  return {
    commands: {
      create: createOrg.execute.bind(createOrg),
      update: updateOrg.execute.bind(updateOrg),
      softDelete: softDeleteOrg.execute.bind(softDeleteOrg),
      restore: restoreOrg.execute.bind(restoreOrg),
    },
    queries: {
      findById: findOrgById.execute.bind(findOrgById),
      list: listOrgs.execute.bind(listOrgs),
    },
  };
}

export type OrganizationsService = ReturnType<
  typeof createOrganizationsService
>;
