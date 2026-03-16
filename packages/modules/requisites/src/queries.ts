import type { Queryable } from "@bedrock/platform/persistence";

import { createDrizzleRequisiteAccountingBindingsQueryRepository } from "./infra/drizzle/repos/requisite-bindings-repository";
import { createDrizzleRequisiteProvidersQueryRepository } from "./infra/drizzle/repos/requisite-providers-repository";
import { createDrizzleRequisitesQueryRepository } from "./infra/drizzle/repos/requisites-repository";

export function createRequisitesQueries(input: { db: Queryable }) {
  const requisites = createDrizzleRequisitesQueryRepository(input.db);
  const bindings = createDrizzleRequisiteAccountingBindingsQueryRepository(
    input.db,
  );
  const providers = createDrizzleRequisiteProvidersQueryRepository(input.db);

  return {
    findById: requisites.findRequisiteById,
    findActiveById: requisites.findActiveRequisiteById,
    list: requisites.listRequisites,
    listOptions: requisites.listRequisiteOptions,
    listLabelsById: requisites.listLabelsById,
    findSubjectById: requisites.findSubjectById,
    listSubjectsById: requisites.listSubjectsById,
    bindings: {
      findByRequisiteId: bindings.findBindingByRequisiteId,
      listByRequisiteId: bindings.listBindingsByRequisiteId,
    },
    providers: {
      findById: providers.findProviderById,
      findActiveById: providers.findActiveProviderById,
      list: providers.listProviders,
    },
  };
}

export type RequisitesQueries = ReturnType<typeof createRequisitesQueries>;
