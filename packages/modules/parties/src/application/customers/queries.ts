import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  ListCustomersQuerySchema,
  type Customer,
  type ListCustomersQuery,
} from "../../contracts";
import { CustomerNotFoundError } from "../../errors";
import type { PartiesServiceContext } from "../shared/context";

export function createListCustomersHandler(context: PartiesServiceContext) {
  const { customerQueries } = context;

  return async function listCustomers(
    input?: ListCustomersQuery,
  ): Promise<PaginatedList<Customer>> {
    const query = ListCustomersQuerySchema.parse(input ?? {});
    return customerQueries.listCustomers(query);
  };
}

export function createFindCustomerByIdHandler(context: PartiesServiceContext) {
  const { customerQueries } = context;

  return async function findCustomerById(id: string): Promise<Customer> {
    const customer = await customerQueries.findCustomerById(id);
    if (!customer) {
      throw new CustomerNotFoundError(id);
    }

    return customer;
  };
}
