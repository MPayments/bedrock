import { randomUUID } from "node:crypto";

import {
  createPartiesModule,
  type PartiesModule,
  type PartiesModuleDeps,
} from "@bedrock/parties";
import {
  DrizzleCounterpartiesQueries,
  DrizzleCounterpartyGroupReads,
  DrizzleCounterpartyReads,
  DrizzleCustomerReads,
  DrizzleCustomersQueries,
  DrizzlePartyProfilesReads,
  DrizzleOrganizationReads,
  DrizzleOrganizationsQueries,
  DrizzlePartyRegistryUnitOfWork,
  DrizzleRequisiteBindingReads,
  DrizzleRequisiteProviderReads,
  DrizzleRequisiteReads,
  DrizzleRequisitesQueries,
  DrizzleSubAgentProfileReads,
} from "@bedrock/parties/adapters/drizzle";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

export function createApiPartiesModule(input: {
  db: Database;
  logger: Logger;
  documents: PartiesModuleDeps["documents"];
  currencies: PartiesModuleDeps["currencies"];
  now?: PartiesModuleDeps["now"];
  generateUuid?: PartiesModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}): PartiesModule {
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

export function createApiPartiesReadRuntime(database: Database | Transaction) {
  return {
    counterpartiesQueries: new DrizzleCounterpartiesQueries(database),
    customersQueries: new DrizzleCustomersQueries(database),
    organizationsQueries: new DrizzleOrganizationsQueries(database),
    requisitesQueries: new DrizzleRequisitesQueries(database),
  };
}

export type ApiPartiesReadRuntime = ReturnType<typeof createApiPartiesReadRuntime>;
