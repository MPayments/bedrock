import type { PartyProfileBundle } from "../../party-profiles/application/contracts";
import type { Counterparty } from "./contracts/counterparty.dto";

export function toCounterpartyDto(
  counterparty: {
    id: string;
    externalId: string | null;
    customerId: string | null;
    relationshipKind: "customer_owned" | "external";
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
    groupIds: string[];
    createdAt: Date;
    updatedAt: Date;
  },
  partyProfile: PartyProfileBundle | null,
): Counterparty {
  return {
    ...counterparty,
    partyProfile,
  };
}
