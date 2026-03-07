import { createCreateCounterpartyRequisiteHandler } from "./commands/create-counterparty-requisite";
import { createFindCounterpartyRequisiteByIdHandler } from "./commands/find-counterparty-requisite-by-id";
import { createListCounterpartyRequisiteOptionsHandler } from "./commands/list-counterparty-requisite-options";
import { createListCounterpartyRequisitesHandler } from "./commands/list-counterparty-requisites";
import { createRemoveCounterpartyRequisiteHandler } from "./commands/remove-counterparty-requisite";
import { createUpdateCounterpartyRequisiteHandler } from "./commands/update-counterparty-requisite";
import {
  createCounterpartyRequisitesServiceContext,
  type CounterpartyRequisitesServiceDeps,
} from "./internal/context";

export type CounterpartyRequisitesService = ReturnType<
  typeof createCounterpartyRequisitesService
>;

export function createCounterpartyRequisitesService(
  deps: CounterpartyRequisitesServiceDeps,
) {
  const context = createCounterpartyRequisitesServiceContext(deps);

  const list = createListCounterpartyRequisitesHandler(context);
  const findById = createFindCounterpartyRequisiteByIdHandler(context);
  const create = createCreateCounterpartyRequisiteHandler(context);
  const update = createUpdateCounterpartyRequisiteHandler(context);
  const remove = createRemoveCounterpartyRequisiteHandler(context);
  const listOptions = createListCounterpartyRequisiteOptionsHandler(context);

  return {
    list,
    findById,
    create,
    update,
    remove,
    listOptions,
  };
}
