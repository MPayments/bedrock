import type { Database } from "@bedrock/platform/persistence";

import {
  createPartiesQueryHandlers,
  type PartiesQueries,
} from "./application/queries";
import { createDrizzleCounterpartiesQueryRepository } from "./infra/drizzle/repos/counterparties-repository";
import { createDrizzleCustomersQueryRepository } from "./infra/drizzle/repos/customers-repository";

export function createPartiesQueries(input: {
  db: Database;
}): PartiesQueries {
  return createPartiesQueryHandlers({
    parties: {
      ...createDrizzleCustomersQueryRepository(input.db),
      ...createDrizzleCounterpartiesQueryRepository(input.db),
    },
  });
}

export type {
  CounterpartiesQueries,
  CustomersQueries,
  PartiesQueries,
} from "./application/queries";
