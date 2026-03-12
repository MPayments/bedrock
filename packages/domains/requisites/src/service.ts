import { createCreateRequisiteHandler } from "./commands/create-requisite";
import { createFindRequisiteByIdHandler } from "./commands/find-requisite-by-id";
import { createGetRequisiteAccountingBindingHandler } from "./commands/get-requisite-accounting-binding";
import { createListRequisiteOptionsHandler } from "./commands/list-requisite-options";
import { createListRequisitesHandler } from "./commands/list-requisites";
import { createRemoveRequisiteHandler } from "./commands/remove-requisite";
import { createResolveRequisiteBindingsHandler } from "./commands/resolve-requisite-bindings";
import { createUpdateRequisiteHandler } from "./commands/update-requisite";
import { createUpsertRequisiteAccountingBindingHandler } from "./commands/upsert-requisite-accounting-binding";
import {
  createRequisitesServiceContext,
  type RequisitesServiceDeps,
} from "./internal/context";

export type RequisitesService = ReturnType<typeof createRequisitesService>;

export function createRequisitesService(deps: RequisitesServiceDeps) {
  const context = createRequisitesServiceContext(deps);

  const list = createListRequisitesHandler(context);
  const findById = createFindRequisiteByIdHandler(context);
  const create = createCreateRequisiteHandler(context);
  const update = createUpdateRequisiteHandler(context);
  const remove = createRemoveRequisiteHandler(context);
  const listOptions = createListRequisiteOptionsHandler(context);
  const getBinding = createGetRequisiteAccountingBindingHandler(context);
  const upsertBinding = createUpsertRequisiteAccountingBindingHandler(context);
  const resolveBindings = createResolveRequisiteBindingsHandler(context);

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
