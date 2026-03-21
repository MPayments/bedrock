import {
  ListCounterpartiesQuerySchema,
  type ListCounterpartiesQuery as ListCounterpartiesInput,
} from "../contracts/counterparty.queries";
import type { CounterpartyReads } from "../ports/counterparty.reads";

export class ListCounterpartiesQuery {
  constructor(private readonly counterpartyReads: CounterpartyReads) {}

  execute(input?: ListCounterpartiesInput) {
    const query = ListCounterpartiesQuerySchema.parse(input ?? {});

    return this.counterpartyReads.list(query);
  }
}
