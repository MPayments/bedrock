import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createModuleRuntime,
  type Clock,
  type UuidGenerator,
} from "@bedrock/shared/core";

import { createCounterpartiesService } from "./counterparties/application";
import type { CounterpartiesCommandUnitOfWork } from "./counterparties/application/ports/counterparties.uow";
import type { CounterpartyGroupReads } from "./counterparties/application/ports/counterparty-group.reads";
import type { CounterpartyReads } from "./counterparties/application/ports/counterparty.reads";
import { createCustomersService } from "./customers/application";
import type { CustomerReads } from "./customers/application/ports/customer.reads";
import type { CustomersCommandUnitOfWork } from "./customers/application/ports/customers.uow";
import { createPartyProfilesService } from "./party-profiles/application";
import type { PartyProfilesReads } from "./party-profiles/application/ports/party-profiles.reads";
import type { PartyProfilesCommandUnitOfWork } from "./party-profiles/application/ports/party-profiles.uow";
import { createOrganizationsService } from "./organizations/application";
import type { OrganizationReads } from "./organizations/application/ports/organization.reads";
import type { OrganizationsCommandUnitOfWork } from "./organizations/application/ports/organizations.uow";
import { createRequisitesService } from "./requisites/application";
import type { RequisitesCurrenciesPort } from "./requisites/application/ports/currencies.port";
import type { RequisiteBindingReads } from "./requisites/application/ports/requisite-binding.reads";
import type { RequisiteProviderReads } from "./requisites/application/ports/requisite-provider.reads";
import type { RequisiteReads } from "./requisites/application/ports/requisite.reads";
import type { RequisitesCommandUnitOfWork } from "./requisites/application/ports/requisites.uow";
import type { PartyRegistryDocumentsReadPort } from "./shared/application/documents-read.port";
import { createSubAgentProfilesService } from "./sub-agent-profiles/application";
import type { SubAgentProfileReads } from "./sub-agent-profiles/application/ports/sub-agent-profile.reads";
import type { SubAgentProfilesCommandUnitOfWork } from "./sub-agent-profiles/application/ports/sub-agent-profiles.uow";

export type PartiesModuleUnitOfWork = CounterpartiesCommandUnitOfWork &
  CustomersCommandUnitOfWork &
  PartyProfilesCommandUnitOfWork &
  OrganizationsCommandUnitOfWork &
  RequisitesCommandUnitOfWork &
  SubAgentProfilesCommandUnitOfWork;

export interface PartiesModuleDeps {
  logger: Logger;
  now: Clock;
  generateUuid: UuidGenerator;
  documents: PartyRegistryDocumentsReadPort;
  currencies: RequisitesCurrenciesPort;
  customerReads: CustomerReads;
  counterpartyReads: CounterpartyReads;
  counterpartyGroupReads: CounterpartyGroupReads;
  partyProfileReads: PartyProfilesReads;
  organizationReads: OrganizationReads;
  requisiteReads: RequisiteReads;
  requisiteProviderReads: RequisiteProviderReads;
  requisiteBindingReads: RequisiteBindingReads;
  subAgentProfileReads: SubAgentProfileReads;
  unitOfWork: PartiesModuleUnitOfWork;
}

export type PartiesModule = ReturnType<typeof createPartiesModule>;

export function createPartiesModule(deps: PartiesModuleDeps) {
  const createRuntime = (service: string) =>
    createModuleRuntime({
      logger: deps.logger,
      now: deps.now,
      generateUuid: deps.generateUuid,
      service,
    });

  return {
    customers: createCustomersService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("parties.customers"),
      documents: deps.documents,
      reads: deps.customerReads,
    }),
    counterparties: createCounterpartiesService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("parties.counterparties"),
      reads: deps.counterpartyReads,
      groupReads: deps.counterpartyGroupReads,
    }),
    partyProfiles: createPartyProfilesService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("parties.party-profiles"),
      reads: deps.partyProfileReads,
    }),
    organizations: createOrganizationsService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("parties.organizations"),
      reads: deps.organizationReads,
    }),
    requisites: createRequisitesService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("parties.requisites"),
      currencies: deps.currencies,
      organizationReads: deps.organizationReads,
      counterpartyReads: deps.counterpartyReads,
      reads: deps.requisiteReads,
      providerReads: deps.requisiteProviderReads,
      bindingReads: deps.requisiteBindingReads,
    }),
    subAgentProfiles: createSubAgentProfilesService({
      commandUow: deps.unitOfWork,
      runtime: createRuntime("parties.sub-agent-profiles"),
      reads: deps.subAgentProfileReads,
    }),
  };
}
