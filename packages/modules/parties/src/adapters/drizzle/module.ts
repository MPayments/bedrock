import { randomUUID } from "node:crypto";

import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import {
  createPartiesModule,
  type PartiesModule,
  type PartiesModuleDeps,
} from "../../module";
import { DrizzleCounterpartyGroupReads } from "../../counterparties/adapters/drizzle/counterparty-group.reads";
import { DrizzleCounterpartyReads } from "../../counterparties/adapters/drizzle/counterparty.reads";
import { DrizzleCustomerReads } from "../../customers/adapters/drizzle/customer.reads";
import { DrizzleOrganizationReads } from "../../organizations/adapters/drizzle/organization.reads";
import { DrizzlePartyProfilesReads } from "../../party-profiles/adapters/drizzle/party-profiles.reads";
import { DrizzleRequisiteBindingReads } from "../../requisites/adapters/drizzle/requisite-binding.reads";
import { DrizzleRequisiteProviderReads } from "../../requisites/adapters/drizzle/requisite-provider.reads";
import { DrizzleRequisiteReads } from "../../requisites/adapters/drizzle/requisite.reads";
import { DrizzlePartyRegistryUnitOfWork } from "../../shared/adapters/drizzle/party-registry.uow";
import { DrizzleSubAgentProfileReads } from "../../sub-agent-profiles/adapters/drizzle/sub-agent-profile.reads";

export interface CreatePartiesModuleFromDrizzleInput {
  currencies: PartiesModuleDeps["currencies"];
  db: Database | Transaction;
  documents: PartiesModuleDeps["documents"];
  generateUuid?: PartiesModuleDeps["generateUuid"];
  logger: Logger;
  now?: PartiesModuleDeps["now"];
  persistence?: PersistenceContext;
}

export function createPartiesModuleFromDrizzle(
  input: CreatePartiesModuleFromDrizzleInput,
): PartiesModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);

  return createPartiesModule({
    counterpartyGroupReads: new DrizzleCounterpartyGroupReads(input.db),
    counterpartyReads: new DrizzleCounterpartyReads(input.db),
    currencies: input.currencies,
    customerReads: new DrizzleCustomerReads(input.db),
    documents: input.documents,
    generateUuid: input.generateUuid ?? randomUUID,
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    organizationReads: new DrizzleOrganizationReads(input.db),
    partyProfileReads: new DrizzlePartyProfilesReads(input.db),
    requisiteBindingReads: new DrizzleRequisiteBindingReads(input.db),
    requisiteProviderReads: new DrizzleRequisiteProviderReads(input.db),
    requisiteReads: new DrizzleRequisiteReads(input.db),
    subAgentProfileReads: new DrizzleSubAgentProfileReads(input.db),
    unitOfWork: new DrizzlePartyRegistryUnitOfWork({ persistence }),
  });
}
