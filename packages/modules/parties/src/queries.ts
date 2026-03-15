import type { Queryable } from "@bedrock/platform/persistence";

import {
  createPartiesQueryHandlers,
  type PartiesQueries,
} from "./application/queries";
import { createDrizzlePartiesRepository } from "./infra/drizzle/repos/parties-repository";

export function createPartiesQueries(input: {
  db: Queryable;
}): PartiesQueries {
  return createPartiesQueryHandlers({
    parties: createDrizzlePartiesRepository(input.db),
  });
}

export type {
  CounterpartiesQueries,
  CustomersQueries,
  PartiesQueries,
} from "./application/queries";
