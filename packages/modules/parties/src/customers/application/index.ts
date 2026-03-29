import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateCustomerCommand } from "./commands/create-customer";
import { RemoveCustomerCommand } from "./commands/remove-customer";
import { UpdateCustomerCommand } from "./commands/update-customer";
import type { CustomerReads } from "./ports/customer.reads";
import type { CustomersCommandUnitOfWork } from "./ports/customers.uow";
import { FindCustomerByExternalRefQuery } from "./queries/find-customer-by-external-ref";
import { FindCustomerByIdQuery } from "./queries/find-customer-by-id";
import { ListCustomersQuery } from "./queries/list-customers";
import { ListCustomersByIdsQuery } from "./queries/list-customers-by-ids";
import type { PartyRegistryDocumentsReadPort } from "../../shared/application/documents-read.port";

export interface CustomersServiceDeps {
  commandUow: CustomersCommandUnitOfWork;
  runtime: ModuleRuntime;
  documents: PartyRegistryDocumentsReadPort;
  reads: CustomerReads;
}

export function createCustomersService(deps: CustomersServiceDeps) {
  const createCustomer = new CreateCustomerCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateCustomer = new UpdateCustomerCommand(
    deps.runtime,
    deps.commandUow,
  );
  const removeCustomer = new RemoveCustomerCommand(
    deps.runtime,
    deps.reads,
    deps.documents,
    deps.commandUow,
  );
  const listCustomers = new ListCustomersQuery(deps.reads);
  const listCustomersByIds = new ListCustomersByIdsQuery(deps.reads);
  const findCustomerByExternalRef = new FindCustomerByExternalRefQuery(
    deps.reads,
  );
  const findCustomerById = new FindCustomerByIdQuery(deps.reads);

  return {
    commands: {
      create: createCustomer.execute.bind(createCustomer),
      update: updateCustomer.execute.bind(updateCustomer),
      remove: removeCustomer.execute.bind(removeCustomer),
    },
    queries: {
      findByExternalRef:
        findCustomerByExternalRef.execute.bind(findCustomerByExternalRef),
      list: listCustomers.execute.bind(listCustomers),
      listByIds: listCustomersByIds.execute.bind(listCustomersByIds),
      findById: findCustomerById.execute.bind(findCustomerById),
    },
  };
}

export type CustomersService = ReturnType<typeof createCustomersService>;
