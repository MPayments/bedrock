import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleCounterpartyGroupHierarchyReads } from "../../../counterparties/adapters/drizzle/counterparty-group-hierarchy.reads";
import { DrizzleCounterpartyGroupRepository } from "../../../counterparties/adapters/drizzle/counterparty-group.repository";
import { DrizzleCounterpartyRepository } from "../../../counterparties/adapters/drizzle/counterparty.repository";
import { DrizzleCustomerMembershipStore } from "../../../customer-memberships/adapters/drizzle/customer-membership.store";
import type {
  CustomerMembershipsCommandTx,
  CustomerMembershipsCommandUnitOfWork,
} from "../../../customer-memberships/application/ports/customer-memberships.uow";
import type {
  CounterpartiesCommandTx,
  CounterpartiesCommandUnitOfWork,
} from "../../../counterparties/application/ports/counterparties.uow";
import { DrizzleCustomerStore } from "../../../customers/adapters/drizzle/customer.store";
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

type PartyRegistryTx =
  & CounterpartiesCommandTx
  & CustomerMembershipsCommandTx
  & CustomersCommandTx
  & OrganizationsCommandTx
  & RequisitesCommandTx;

function bindPartyRegistryTx(tx: Transaction): PartyRegistryTx {
  const counterpartyGroups = new DrizzleCounterpartyGroupRepository(tx);

  return {
    customerMembershipStore: new DrizzleCustomerMembershipStore(tx),
    customerStore: new DrizzleCustomerStore(tx),
    organizationStore: new DrizzleOrganizationStore(tx),
    counterparties: new DrizzleCounterpartyRepository(tx),
    counterpartyGroupHierarchy: new DrizzleCounterpartyGroupHierarchyReads(tx),
    counterpartyGroups,
    requisites: new DrizzleRequisiteRepository(tx),
    requisiteProviderStore: new DrizzleRequisiteProviderStore(tx),
    requisiteBindingStore: new DrizzleRequisiteBindingStore(tx),
  };
}

export class DrizzlePartyRegistryUnitOfWork
  implements
    CounterpartiesCommandUnitOfWork,
    CustomerMembershipsCommandUnitOfWork,
    CustomersCommandUnitOfWork,
    OrganizationsCommandUnitOfWork,
    RequisitesCommandUnitOfWork
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
