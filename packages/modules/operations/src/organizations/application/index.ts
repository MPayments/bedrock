import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateBankDetailsCommand } from "./commands/create-bank-details";
import { CreateOrganizationCommand } from "./commands/create-organization";
import { RestoreBankDetailsCommand } from "./commands/restore-bank-details";
import { RestoreOrganizationCommand } from "./commands/restore-organization";
import { SoftDeleteBankDetailsCommand } from "./commands/soft-delete-bank-details";
import { SoftDeleteOrganizationCommand } from "./commands/soft-delete-organization";
import { UpdateBankDetailsCommand } from "./commands/update-bank-details";
import { UpdateOrganizationCommand } from "./commands/update-organization";
import type { BankDetailsReads } from "./ports/bank-details.reads";
import type { OrganizationReads } from "./ports/organization.reads";
import type { OrganizationsCommandUnitOfWork } from "./ports/organizations.uow";
import { FindBankDetailsByIdQuery } from "./queries/find-bank-details-by-id";
import { FindOrganizationByIdQuery } from "./queries/find-organization-by-id";
import { ListBankDetailsQuery } from "./queries/list-bank-details";
import { ListOrganizationsQuery } from "./queries/list-organizations";

export interface OrganizationsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: OrganizationsCommandUnitOfWork;
  reads: OrganizationReads;
  bankDetailsReads: BankDetailsReads;
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

  const createBankDetails = new CreateBankDetailsCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateBankDetails = new UpdateBankDetailsCommand(
    deps.runtime,
    deps.commandUow,
  );
  const softDeleteBankDetails = new SoftDeleteBankDetailsCommand(
    deps.runtime,
    deps.commandUow,
  );
  const restoreBankDetails = new RestoreBankDetailsCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findBankDetailsById = new FindBankDetailsByIdQuery(
    deps.bankDetailsReads,
  );
  const listBankDetails = new ListBankDetailsQuery(deps.bankDetailsReads);

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
    bankDetails: {
      commands: {
        create: createBankDetails.execute.bind(createBankDetails),
        update: updateBankDetails.execute.bind(updateBankDetails),
        softDelete: softDeleteBankDetails.execute.bind(softDeleteBankDetails),
        restore: restoreBankDetails.execute.bind(restoreBankDetails),
      },
      queries: {
        findById: findBankDetailsById.execute.bind(findBankDetailsById),
        list: listBankDetails.execute.bind(listBankDetails),
        listByOrganizationId:
          deps.bankDetailsReads.listByOrganizationId.bind(
            deps.bankDetailsReads,
          ),
      },
    },
  };
}

export type OrganizationsService = ReturnType<
  typeof createOrganizationsService
>;
