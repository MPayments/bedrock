import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateClientCommand } from "./commands/create-client";
import { SoftDeleteClientCommand } from "./commands/soft-delete-client";
import { UpdateClientCommand } from "./commands/update-client";
import type { ClientReads } from "./ports/client.reads";
import type { ClientsCommandUnitOfWork } from "./ports/clients.uow";
import type { CompanyLookupPort } from "./ports/company-lookup.port";
import type { CounterpartiesPort } from "./ports/counterparties.port";
import { FindClientByIdQuery } from "./queries/find-client-by-id";
import { ListClientsQuery } from "./queries/list-clients";
import { SearchCompanyQuery } from "./queries/search-company";

export interface ClientsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: ClientsCommandUnitOfWork;
  reads: ClientReads;
  counterparties?: CounterpartiesPort;
  companyLookup?: CompanyLookupPort;
}

export function createClientsService(deps: ClientsServiceDeps) {
  const createClient = new CreateClientCommand(
    deps.runtime,
    deps.commandUow,
    deps.counterparties,
  );
  const updateClient = new UpdateClientCommand(deps.runtime, deps.commandUow);
  const softDeleteClient = new SoftDeleteClientCommand(
    deps.runtime,
    deps.commandUow,
  );
  const findById = new FindClientByIdQuery(deps.reads);
  const listClients = new ListClientsQuery(deps.reads);

  const searchCompany = deps.companyLookup
    ? new SearchCompanyQuery(deps.companyLookup)
    : null;

  return {
    commands: {
      create: createClient.execute.bind(createClient),
      update: updateClient.execute.bind(updateClient),
      softDelete: softDeleteClient.execute.bind(softDeleteClient),
    },
    queries: {
      findById: findById.execute.bind(findById),
      list: listClients.execute.bind(listClients),
      ...(searchCompany && {
        searchCompany: searchCompany.execute.bind(searchCompany),
      }),
    },
  };
}

export type ClientsService = ReturnType<typeof createClientsService>;
