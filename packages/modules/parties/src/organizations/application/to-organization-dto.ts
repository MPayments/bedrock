import type { Organization } from "./contracts/dto";
import type { PartyProfileBundle } from "../../party-profiles/application/contracts";

export function toOrganizationDto(
  organization: {
    id: string;
    externalRef: string | null;
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
    isActive: boolean;
    signatureKey: string | null;
    sealKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  partyProfile: PartyProfileBundle | null,
): Organization {
  return {
    ...organization,
    partyProfile,
  };
}
