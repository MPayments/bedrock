import type { PaginatedList } from "@bedrock/shared/core/pagination";

import {
  ListCounterpartiesQuerySchema,
  type Counterparty,
  type ListCounterpartiesQuery,
} from "../../contracts";
import { CounterpartyNotFoundError } from "../../errors";
import type { PartiesServiceContext } from "../shared/context";

export function createListCounterpartiesHandler(
  context: PartiesServiceContext,
) {
  const { counterpartyQueries } = context;

  return async function listCounterparties(
    input?: ListCounterpartiesQuery,
  ): Promise<PaginatedList<Counterparty>> {
    const query = ListCounterpartiesQuerySchema.parse(input ?? {});
    return counterpartyQueries.listCounterparties(query);
  };
}

export function createFindCounterpartyByIdHandler(
  context: PartiesServiceContext,
) {
  const { counterpartyQueries } = context;

  return async function findCounterpartyById(id: string): Promise<Counterparty> {
    const counterparty = await counterpartyQueries.findCounterpartyById(id);
    if (!counterparty) {
      throw new CounterpartyNotFoundError(id);
    }

    return counterparty;
  };
}
