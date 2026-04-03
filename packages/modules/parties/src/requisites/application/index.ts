import type { ModuleRuntime } from "@bedrock/shared/core";

import { CreateRequisiteCommand } from "./commands/create-requisite";
import { CreateRequisiteProviderCommand } from "./commands/create-requisite-provider";
import { RemoveRequisiteCommand } from "./commands/remove-requisite";
import { RemoveRequisiteProviderCommand } from "./commands/remove-requisite-provider";
import { UpdateRequisiteCommand } from "./commands/update-requisite";
import { UpdateRequisiteProviderCommand } from "./commands/update-requisite-provider";
import { UpsertRequisiteBindingCommand } from "./commands/upsert-requisite-binding";
import type { RequisitesCurrenciesPort } from "./ports/currencies.port";
import type { RequisiteBindingReads } from "./ports/requisite-binding.reads";
import type { RequisiteProviderReads } from "./ports/requisite-provider.reads";
import type { RequisiteReads } from "./ports/requisite.reads";
import type { RequisitesCommandUnitOfWork } from "./ports/requisites.uow";
import { FindOrganizationBankByIdQuery } from "./queries/find-organization-bank-by-id";
import { FindPreferredCounterpartyBankByCounterpartyIdQuery } from "./queries/find-preferred-counterparty-bank-by-counterparty-id";
import { FindRequisiteByIdQuery } from "./queries/find-requisite-by-id";
import { FindRequisiteProviderByIdQuery } from "./queries/find-requisite-provider-by-id";
import { GetRequisiteBindingQuery } from "./queries/get-requisite-binding";
import { ListRequisiteOptionsQuery } from "./queries/list-requisite-options";
import { ListRequisiteProvidersQuery } from "./queries/list-requisite-providers";
import { ListRequisitesQuery } from "./queries/list-requisites";
import { ResolveRequisiteBindingsQuery } from "./queries/resolve-requisite-bindings";
import type { CounterpartyReads } from "../../counterparties/application/ports/counterparty.reads";
import type { OrganizationReads } from "../../organizations/application/ports/organization.reads";

export interface RequisitesServiceDeps {
  commandUow: RequisitesCommandUnitOfWork;
  runtime: ModuleRuntime;
  currencies: RequisitesCurrenciesPort;
  organizationReads: OrganizationReads;
  counterpartyReads: CounterpartyReads;
  reads: RequisiteReads;
  providerReads: RequisiteProviderReads;
  bindingReads: RequisiteBindingReads;
}

export function createRequisitesService(deps: RequisitesServiceDeps) {
  const createRequisite = new CreateRequisiteCommand(
    deps.runtime,
    deps.currencies,
    deps.organizationReads,
    deps.counterpartyReads,
    deps.providerReads,
    deps.commandUow,
  );
  const updateRequisite = new UpdateRequisiteCommand(
    deps.runtime,
    deps.currencies,
    deps.providerReads,
    deps.commandUow,
  );
  const removeRequisite = new RemoveRequisiteCommand(
    deps.runtime,
    deps.commandUow,
  );
  const createRequisiteProvider = new CreateRequisiteProviderCommand(
    deps.runtime,
    deps.commandUow,
  );
  const updateRequisiteProvider = new UpdateRequisiteProviderCommand(
    deps.runtime,
    deps.commandUow,
  );
  const removeRequisiteProvider = new RemoveRequisiteProviderCommand(
    deps.runtime,
    deps.commandUow,
  );
  const upsertRequisiteBinding = new UpsertRequisiteBindingCommand(
    deps.runtime,
    deps.currencies,
    deps.commandUow,
  );
  const listRequisites = new ListRequisitesQuery(deps.reads);
  const findRequisiteById = new FindRequisiteByIdQuery(deps.reads);
  const findOrganizationBankById = new FindOrganizationBankByIdQuery(
    deps.reads,
  );
  const findPreferredCounterpartyBankByCounterpartyId =
    new FindPreferredCounterpartyBankByCounterpartyIdQuery(deps.reads);
  const listRequisiteOptions = new ListRequisiteOptionsQuery(deps.reads);
  const listRequisiteProviders = new ListRequisiteProvidersQuery(
    deps.providerReads,
  );
  const findRequisiteProviderById = new FindRequisiteProviderByIdQuery(
    deps.providerReads,
  );
  const getRequisiteBinding = new GetRequisiteBindingQuery(
    deps.reads,
    deps.bindingReads,
  );
  const resolveRequisiteBindings = new ResolveRequisiteBindingsQuery(
    deps.reads,
    deps.bindingReads,
    deps.runtime.log,
  );

  return {
    commands: {
      create: createRequisite.execute.bind(createRequisite),
      update: updateRequisite.execute.bind(updateRequisite),
      remove: removeRequisite.execute.bind(removeRequisite),
      createProvider: createRequisiteProvider.execute.bind(createRequisiteProvider),
      updateProvider: updateRequisiteProvider.execute.bind(updateRequisiteProvider),
      removeProvider: removeRequisiteProvider.execute.bind(removeRequisiteProvider),
      upsertBinding: upsertRequisiteBinding.execute.bind(upsertRequisiteBinding),
    },
    queries: {
      list: listRequisites.execute.bind(listRequisites),
      findById: findRequisiteById.execute.bind(findRequisiteById),
      findOrganizationBankById:
        findOrganizationBankById.execute.bind(findOrganizationBankById),
      findPreferredCounterpartyBankByCounterpartyId:
        findPreferredCounterpartyBankByCounterpartyId.execute.bind(
          findPreferredCounterpartyBankByCounterpartyId,
        ),
      listOptions: listRequisiteOptions.execute.bind(listRequisiteOptions),
      listProviders: listRequisiteProviders.execute.bind(listRequisiteProviders),
      findProviderById: findRequisiteProviderById.execute.bind(
        findRequisiteProviderById,
      ),
      getBinding: getRequisiteBinding.execute.bind(getRequisiteBinding),
      resolveBindings: resolveRequisiteBindings.execute.bind(
        resolveRequisiteBindings,
      ),
    },
  };
}

export type RequisitesService = ReturnType<typeof createRequisitesService>;
