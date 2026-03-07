import { createCreateOrganizationRequisiteHandler } from "./commands/create-organization-requisite";
import { createFindOrganizationRequisiteByIdHandler } from "./commands/find-organization-requisite-by-id";
import { createGetOrganizationRequisiteBindingHandler } from "./commands/get-organization-requisite-binding";
import { createListOrganizationRequisiteOptionsHandler } from "./commands/list-organization-requisite-options";
import { createListOrganizationRequisitesHandler } from "./commands/list-organization-requisites";
import { createRemoveOrganizationRequisiteHandler } from "./commands/remove-organization-requisite";
import { createResolveOrganizationRequisiteBindingsHandler } from "./commands/resolve-organization-requisite-bindings";
import { createUpdateOrganizationRequisiteHandler } from "./commands/update-organization-requisite";
import { createUpsertOrganizationRequisiteBindingHandler } from "./commands/upsert-organization-requisite-binding";
import {
  createOrganizationRequisitesServiceContext,
  type OrganizationRequisitesServiceDeps,
} from "./internal/context";

export type OrganizationRequisitesService = ReturnType<
  typeof createOrganizationRequisitesService
>;

export function createOrganizationRequisitesService(
  deps: OrganizationRequisitesServiceDeps,
) {
  const context = createOrganizationRequisitesServiceContext(deps);

  const list = createListOrganizationRequisitesHandler(context);
  const findById = createFindOrganizationRequisiteByIdHandler(context);
  const create = createCreateOrganizationRequisiteHandler(context);
  const update = createUpdateOrganizationRequisiteHandler(context);
  const remove = createRemoveOrganizationRequisiteHandler(context);
  const listOptions = createListOrganizationRequisiteOptionsHandler(context);
  const getBinding = createGetOrganizationRequisiteBindingHandler(context);
  const upsertBinding = createUpsertOrganizationRequisiteBindingHandler(context);
  const resolveBindings = createResolveOrganizationRequisiteBindingsHandler(
    context,
  );

  return {
    list,
    findById,
    create,
    update,
    remove,
    listOptions,
    getBinding,
    upsertBinding,
    resolveBindings,
  };
}
