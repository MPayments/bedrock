import { createCreateRequisiteProviderHandler } from "./commands/create-requisite-provider";
import { createFindRequisiteProviderByIdHandler } from "./commands/find-requisite-provider-by-id";
import { createListRequisiteProvidersHandler } from "./commands/list-requisite-providers";
import { createRemoveRequisiteProviderHandler } from "./commands/remove-requisite-provider";
import { createUpdateRequisiteProviderHandler } from "./commands/update-requisite-provider";
import {
  createRequisiteProvidersServiceContext,
  type RequisiteProvidersServiceDeps,
} from "./internal/context";

export type RequisiteProvidersService = ReturnType<
  typeof createRequisiteProvidersService
>;

export function createRequisiteProvidersService(
  deps: RequisiteProvidersServiceDeps,
) {
  const context = createRequisiteProvidersServiceContext(deps);

  const list = createListRequisiteProvidersHandler(context);
  const findById = createFindRequisiteProviderByIdHandler(context);
  const create = createCreateRequisiteProviderHandler(context);
  const update = createUpdateRequisiteProviderHandler(context);
  const remove = createRemoveRequisiteProviderHandler(context);

  return {
    list,
    findById,
    create,
    update,
    remove,
  };
}
