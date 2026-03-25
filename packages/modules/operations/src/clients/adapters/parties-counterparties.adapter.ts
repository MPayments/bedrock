import type { PartiesModule } from "@bedrock/parties";

import type { CounterpartiesPort } from "../application/ports/counterparties.port";

export interface PartiesCounterpartiesAdapterDeps {
  createCounterparty: PartiesModule["counterparties"]["commands"]["create"];
  listCounterparties: PartiesModule["counterparties"]["queries"]["list"];
}

export class PartiesCounterpartiesAdapter implements CounterpartiesPort {
  constructor(private readonly deps: PartiesCounterpartiesAdapterDeps) {}

  async findOrCreateCounterparty(input: {
    displayName: string;
    externalRef?: string | null;
  }): Promise<string> {
    if (input.externalRef) {
      const existing = await this.deps.listCounterparties({
        externalId: input.externalRef,
        limit: 1,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (existing.data.length > 0) {
        return existing.data[0]!.id;
      }
    }

    const counterparty = await this.deps.createCounterparty({
      shortName: input.displayName,
      fullName: input.displayName,
      kind: "legal_entity",
      country: "RU",
      externalId: input.externalRef ?? null,
    });

    return counterparty.id;
  }
}
