import {
  ListCounterpartyGroupsQuerySchema,
  type CounterpartyGroup,
  type ListCounterpartyGroupsQuery,
} from "../../contracts";
import type { PartiesServiceContext } from "../shared/context";

export function createListCounterpartyGroupsHandler(
  context: PartiesServiceContext,
) {
  const { groupQueries } = context;

  return async function listCounterpartyGroups(
    input?: ListCounterpartyGroupsQuery,
  ): Promise<CounterpartyGroup[]> {
    const query = ListCounterpartyGroupsQuerySchema.parse(input ?? {});
    return groupQueries.listCounterpartyGroups(query);
  };
}
