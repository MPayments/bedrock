import type { PartiesModule } from "@bedrock/parties";

import type { CounterpartiesPort } from "../application/ports/counterparties.port";

export interface PartiesCounterpartiesAdapterDeps {
  createCounterparty: PartiesModule["counterparties"]["commands"]["create"];
  findCounterpartyById: PartiesModule["counterparties"]["queries"]["findById"];
  updateCounterparty: PartiesModule["counterparties"]["commands"]["update"];
}

function normalizeCountryCode(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length === 2 ? normalized : null;
}

export class PartiesCounterpartiesAdapter implements CounterpartiesPort {
  constructor(private readonly deps: PartiesCounterpartiesAdapterDeps) {}

  async createCustomerOwnedCounterparty(input: {
    country?: string | null;
    customerId: string;
    displayName: string;
    externalId?: string | null;
  }): Promise<string> {
    const counterparty = await this.deps.createCounterparty({
      shortName: input.displayName,
      fullName: input.displayName,
      kind: "legal_entity",
      relationshipKind: "customer_owned",
      country: normalizeCountryCode(input.country),
      customerId: input.customerId,
      externalId: input.externalId ?? null,
    });

    return counterparty.id;
  }

  async syncCustomerOwnedCounterparty(input: {
    counterpartyId: string;
    country?: string | null;
    customerId: string;
    displayName: string;
    externalId?: string | null;
  }): Promise<void> {
    const existing = await this.deps.findCounterpartyById(input.counterpartyId);
    if (!existing) {
      throw new Error(`Counterparty ${input.counterpartyId} not found`);
    }

    await this.deps.updateCounterparty(input.counterpartyId, {
      shortName: input.displayName,
      fullName: input.displayName,
      relationshipKind: "customer_owned",
      country: normalizeCountryCode(input.country),
      customerId: input.customerId,
      externalId: input.externalId ?? null,
    });
  }
}
