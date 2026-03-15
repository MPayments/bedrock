import type { Queryable } from "@bedrock/platform/persistence";

import {
  createRequisitesQueryHandlers,
  type RequisitesQueries,
} from "./application/queries";
import { createDrizzleRequisitesRepository } from "./infra/drizzle/repos/requisites-repository";

export function createRequisitesQueries(input: {
  db: Queryable;
}): RequisitesQueries {
  return createRequisitesQueryHandlers({
    requisites: createDrizzleRequisitesRepository(input.db),
  });
}

export type { RequisiteQueryRecord, RequisitesQueries } from "./application/queries";
