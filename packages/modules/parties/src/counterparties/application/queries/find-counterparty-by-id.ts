import { CounterpartyNotFoundError } from "../errors";
import type { CounterpartyReads } from "../ports/counterparty.reads";

export class FindCounterpartyByIdQuery {
  constructor(private readonly counterpartyReads: CounterpartyReads) {}

  async execute(id: string) {
    const counterparty = await this.counterpartyReads.findById(id);
    if (!counterparty) {
      throw new CounterpartyNotFoundError(id);
    }

    return counterparty;
  }
}
