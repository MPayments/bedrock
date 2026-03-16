import { resolvePatchValue } from "@bedrock/shared/core";

import type {
  OrganizationSnapshot,
  UpdateOrganizationProps,
} from "../../domain/organization";
import type { PartyKind } from "../../domain/party-kind";

export function resolveOrganizationUpdateInput(
  current: OrganizationSnapshot,
  patch: {
    externalId?: string | null | undefined;
    shortName?: string;
    fullName?: string;
    description?: string | null | undefined;
    country?: string | null | undefined;
    kind?: PartyKind;
  },
): UpdateOrganizationProps {
  return {
    externalId: resolvePatchValue(current.externalId, patch.externalId),
    shortName: resolvePatchValue(current.shortName, patch.shortName),
    fullName: resolvePatchValue(current.fullName, patch.fullName),
    description: resolvePatchValue(current.description, patch.description),
    country: resolvePatchValue(current.country, patch.country),
    kind: resolvePatchValue(current.kind, patch.kind),
  };
}
