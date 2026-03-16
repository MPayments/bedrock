import { resolvePatchValue } from "@bedrock/shared/core";

import type {
  RequisiteProviderDetails,
  RequisiteProviderSnapshot,
} from "../../domain/requisite-provider";

export function resolveRequisiteProviderUpdateInput(
  current: RequisiteProviderSnapshot,
  patch: {
    kind?: RequisiteProviderSnapshot["kind"];
    name?: string;
    description?: string | null | undefined;
    country?: string | null | undefined;
    address?: string | null | undefined;
    contact?: string | null | undefined;
    bic?: string | null | undefined;
    swift?: string | null | undefined;
  },
): RequisiteProviderDetails {
  return {
    kind: resolvePatchValue(current.kind, patch.kind),
    name: resolvePatchValue(current.name, patch.name),
    description: resolvePatchValue(current.description, patch.description),
    country: resolvePatchValue(current.country, patch.country),
    address: resolvePatchValue(current.address, patch.address),
    contact: resolvePatchValue(current.contact, patch.contact),
    bic: resolvePatchValue(current.bic, patch.bic),
    swift: resolvePatchValue(current.swift, patch.swift),
  };
}
