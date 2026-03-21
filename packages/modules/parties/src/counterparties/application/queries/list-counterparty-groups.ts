import {
  ListCounterpartyGroupsQuerySchema,
  type ListCounterpartyGroupsQuery as ListCounterpartyGroupsInput,
} from "../contracts/counterparty-group.queries";
import type { CounterpartyGroupReads } from "../ports/counterparty-group.reads";

export class ListCounterpartyGroupsQuery {
  constructor(
    private readonly counterpartyGroupReads: CounterpartyGroupReads,
  ) {}

  execute(input?: ListCounterpartyGroupsInput) {
    const query = ListCounterpartyGroupsQuerySchema.parse(input ?? {});
    return this.counterpartyGroupReads.list(query);
  }
}
