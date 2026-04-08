import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleCounterpartyGroupHierarchyReads } from "../../../counterparties/adapters/drizzle/counterparty-group-hierarchy.reads";
import { DrizzleCounterpartyGroupRepository } from "../../../counterparties/adapters/drizzle/counterparty-group.repository";
import { DrizzleCounterpartyRepository } from "../../../counterparties/adapters/drizzle/counterparty.repository";
import type {
  CounterpartiesCommandTx,
  CounterpartiesCommandUnitOfWork,
} from "../../../counterparties/application/ports/counterparties.uow";
import { DrizzleCustomerStore } from "../../../customers/adapters/drizzle/customer.store";
import { DrizzlePartyProfilesStore } from "../../../party-profiles/adapters/drizzle/party-profiles.store";
import type {
  CustomersCommandTx,
  CustomersCommandUnitOfWork,
} from "../../../customers/application/ports/customers.uow";
import { DrizzleOrganizationStore } from "../../../organizations/adapters/drizzle/organization.store";
import type {
  OrganizationsCommandTx,
  OrganizationsCommandUnitOfWork,
} from "../../../organizations/application/ports/organizations.uow";
import { DrizzleRequisiteBindingStore } from "../../../requisites/adapters/drizzle/requisite-binding.store";
import { DrizzleRequisiteProviderStore } from "../../../requisites/adapters/drizzle/requisite-provider.store";
import { DrizzleRequisiteRepository } from "../../../requisites/adapters/drizzle/requisite.repository";
import type {
  RequisitesCommandTx,
  RequisitesCommandUnitOfWork,
} from "../../../requisites/application/ports/requisites.uow";
import { DrizzleSubAgentProfileStore } from "../../../sub-agent-profiles/adapters/drizzle/sub-agent-profile.store";
import type {
  SubAgentProfilesCommandTx,
  SubAgentProfilesCommandUnitOfWork,
} from "../../../sub-agent-profiles/application/ports/sub-agent-profiles.uow";

type PartyRegistryTx =
  & CounterpartiesCommandTx
  & CustomersCommandTx
  & OrganizationsCommandTx
  & RequisitesCommandTx
  & SubAgentProfilesCommandTx;

function bindPartyRegistryTx(tx: Transaction): PartyRegistryTx {
  const counterpartyGroups = new DrizzleCounterpartyGroupRepository(tx);

  return {
    customerStore: new DrizzleCustomerStore(tx),
    partyProfiles: new DrizzlePartyProfilesStore(tx),
    organizationStore: new DrizzleOrganizationStore(tx),
    counterparties: new DrizzleCounterpartyRepository(tx),
    counterpartyGroupHierarchy: new DrizzleCounterpartyGroupHierarchyReads(tx),
    counterpartyGroups,
    requisites: new DrizzleRequisiteRepository(tx),
    requisiteProviderStore: new DrizzleRequisiteProviderStore(tx),
    requisiteBindingStore: new DrizzleRequisiteBindingStore(tx),
    subAgentProfiles: new DrizzleSubAgentProfileStore(tx),
  };
}

export class DrizzlePartyRegistryUnitOfWork
  implements
    CounterpartiesCommandUnitOfWork,
    CustomersCommandUnitOfWork,
    OrganizationsCommandUnitOfWork,
    RequisitesCommandUnitOfWork,
    SubAgentProfilesCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<PartyRegistryTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindPartyRegistryTx,
    );
  }

  run<T>(work: (tx: PartyRegistryTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
