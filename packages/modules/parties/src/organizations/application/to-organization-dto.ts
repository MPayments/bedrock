import type { PartyLegalEntityBundle } from "../../legal-entities/application/contracts";
import type { Organization } from "./contracts/dto";

export function toOrganizationDto(
  organization: {
    id: string;
    externalId: string | null;
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
  legalEntity: PartyLegalEntityBundle | null,
): Organization {
  return {
    ...organization,
    legalEntity,
  };
}
