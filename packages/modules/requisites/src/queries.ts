import type { Database } from "@bedrock/platform/persistence";

import {
  createDrizzleRequisitesQueryRepository,
} from "./infra/drizzle/repos/requisites-repository";
import {
  createDrizzleRequisiteProvidersQueryRepository,
} from "./infra/drizzle/repos/requisite-providers-repository";

export function createRequisitesQueries(input: { db: Database }) {
  const requisites = createDrizzleRequisitesQueryRepository(input.db);
  const providers = createDrizzleRequisiteProvidersQueryRepository(input.db);

  return {
    findById: requisites.findRequisiteById,
    findActiveById: requisites.findActiveRequisiteById,
    list: requisites.listRequisites,
    listOptions: requisites.listRequisiteOptions,
    listLabelsById: requisites.listLabelsById,
    findSubjectById: requisites.findSubjectById,
    listSubjectsById: requisites.listSubjectsById,
    providers: {
      findById: providers.findProviderById,
      findActiveById: providers.findActiveProviderById,
      list: providers.listProviders,
    },
  };
}

export type RequisitesQueries = ReturnType<typeof createRequisitesQueries>;
