import { createCreateCustomerHandler } from "./commands/create-customer";
import { createFindCustomerByIdHandler } from "./commands/find-customer-by-id";
import { createListCustomersHandler } from "./commands/list-customers";
import { createRemoveCustomerHandler } from "./commands/remove-customer";
import { createUpdateCustomerHandler } from "./commands/update-customer";
import {
  createCustomersServiceContext,
  type CustomersServiceDeps,
} from "./internal/context";

export type CustomersService = ReturnType<typeof createCustomersService>;

export function createCustomersService(deps: CustomersServiceDeps) {
  const context = createCustomersServiceContext(deps);

  const list = createListCustomersHandler(context);
  const findById = createFindCustomerByIdHandler(context);
  const create = createCreateCustomerHandler(context);
  const update = createUpdateCustomerHandler(context);
  const remove = createRemoveCustomerHandler(context);

  return {
    list,
    findById,
    create,
    update,
    remove,
  };
}
