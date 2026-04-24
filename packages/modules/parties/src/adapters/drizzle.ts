import { randomUUID } from "node:crypto";

import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import { DrizzleCounterpartiesQueries } from "../counterparties/adapters/drizzle/counterparties.queries";
import { DrizzleCounterpartyGroupReads } from "../counterparties/adapters/drizzle/counterparty-group.reads";
import { DrizzleCounterpartyReads } from "../counterparties/adapters/drizzle/counterparty.reads";
import { DrizzleCustomerReads } from "../customers/adapters/drizzle/customer.reads";
import { DrizzleCustomersQueries } from "../customers/adapters/drizzle/customers.queries";
import {
  createPartiesModule,
  type PartiesModule,
  type PartiesModuleDeps,
} from "../module";
import { DrizzleOrganizationReads } from "../organizations/adapters/drizzle/organization.reads";
import { DrizzleOrganizationsQueries } from "../organizations/adapters/drizzle/organizations.queries";
import { DrizzlePartyProfilesReads } from "../party-profiles/adapters/drizzle/party-profiles.reads";
import { DrizzleRequisiteBindingReads } from "../requisites/adapters/drizzle/requisite-binding.reads";
import { DrizzleRequisiteProviderReads } from "../requisites/adapters/drizzle/requisite-provider.reads";
import { DrizzleRequisiteReads } from "../requisites/adapters/drizzle/requisite.reads";
import { DrizzleRequisitesQueries } from "../requisites/adapters/drizzle/requisites.queries";
import { DrizzlePartyRegistryUnitOfWork } from "../shared/adapters/drizzle/party-registry.uow";
import { DrizzleSubAgentProfileReads } from "../sub-agent-profiles/adapters/drizzle/sub-agent-profile.reads";

export { DrizzleCounterpartyGroupHierarchyReads } from "../counterparties/adapters/drizzle/counterparty-group-hierarchy.reads";
export { DrizzleCounterpartyGroupReads } from "../counterparties/adapters/drizzle/counterparty-group.reads";
export { DrizzleCounterpartyGroupRepository } from "../counterparties/adapters/drizzle/counterparty-group.repository";
export { DrizzleCounterpartiesQueries } from "../counterparties/adapters/drizzle/counterparties.queries";
export { DrizzleCounterpartyReads } from "../counterparties/adapters/drizzle/counterparty.reads";
export { DrizzleCounterpartyRepository } from "../counterparties/adapters/drizzle/counterparty.repository";
export { DrizzleCustomerReads } from "../customers/adapters/drizzle/customer.reads";
export { DrizzleCustomersQueries } from "../customers/adapters/drizzle/customers.queries";
export { DrizzleCustomerStore } from "../customers/adapters/drizzle/customer.store";
export { DrizzlePartyProfilesReads } from "../party-profiles/adapters/drizzle/party-profiles.reads";
export { DrizzlePartyProfilesStore } from "../party-profiles/adapters/drizzle/party-profiles.store";
export { DrizzleOrganizationReads } from "../organizations/adapters/drizzle/organization.reads";
export { DrizzleOrganizationsQueries } from "../organizations/adapters/drizzle/organizations.queries";
export { DrizzleOrganizationStore } from "../organizations/adapters/drizzle/organization.store";
export { DrizzleRequisiteBindingReads } from "../requisites/adapters/drizzle/requisite-binding.reads";
export { DrizzleRequisiteBindingStore } from "../requisites/adapters/drizzle/requisite-binding.store";
export { DrizzleRequisiteProviderReads } from "../requisites/adapters/drizzle/requisite-provider.reads";
export { DrizzleRequisiteProviderStore } from "../requisites/adapters/drizzle/requisite-provider.store";
export { DrizzleRequisiteReads } from "../requisites/adapters/drizzle/requisite.reads";
export { DrizzleRequisiteRepository } from "../requisites/adapters/drizzle/requisite.repository";
export { DrizzleRequisitesQueries } from "../requisites/adapters/drizzle/requisites.queries";
export { DrizzleSubAgentProfileReads } from "../sub-agent-profiles/adapters/drizzle/sub-agent-profile.reads";
export { DrizzleSubAgentProfileStore } from "../sub-agent-profiles/adapters/drizzle/sub-agent-profile.store";
export { DrizzlePartyRegistryUnitOfWork } from "../shared/adapters/drizzle/party-registry.uow";

export interface CreateDrizzlePartiesModuleInput {
  db: Database;
  logger: Logger;
  documents: PartiesModuleDeps["documents"];
  currencies: PartiesModuleDeps["currencies"];
  now?: PartiesModuleDeps["now"];
  generateUuid?: PartiesModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}

export function createDrizzlePartiesReadRuntime(
  database: Database | Transaction,
) {
  return {
    counterpartiesQueries: new DrizzleCounterpartiesQueries(database),
    customersQueries: new DrizzleCustomersQueries(database),
    organizationsQueries: new DrizzleOrganizationsQueries(database),
    requisitesQueries: new DrizzleRequisitesQueries(database),
  };
}

export type DrizzlePartiesReadRuntime = ReturnType<
  typeof createDrizzlePartiesReadRuntime
>;

export function createDrizzlePartiesModule(
  input: CreateDrizzlePartiesModuleInput,
): PartiesModule {
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createPartiesModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    documents: input.documents,
    currencies: input.currencies,
    customerReads: new DrizzleCustomerReads(input.db),
    counterpartyReads: new DrizzleCounterpartyReads(input.db),
    counterpartyGroupReads: new DrizzleCounterpartyGroupReads(input.db),
    partyProfileReads: new DrizzlePartyProfilesReads(input.db),
    organizationReads: new DrizzleOrganizationReads(input.db),
    requisiteReads: new DrizzleRequisiteReads(input.db),
    requisiteProviderReads: new DrizzleRequisiteProviderReads(input.db),
    requisiteBindingReads: new DrizzleRequisiteBindingReads(input.db),
    subAgentProfileReads: new DrizzleSubAgentProfileReads(input.db),
    unitOfWork: new DrizzlePartyRegistryUnitOfWork({ persistence }),
  });
}
