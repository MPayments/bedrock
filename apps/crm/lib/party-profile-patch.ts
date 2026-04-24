import type {
  PartyContactInput,
  PartyIdentifierInput,
  PartyLicenseInput,
  PartyProfileBundleInput,
  PartyRepresentativeInput,
} from "@bedrock/parties/contracts";
import { clonePartyProfileBundleInput } from "@bedrock/sdk-parties-ui/lib/party-profile";

export type PartyProfileOverride = {
  nonce: number;
  patch: Partial<PartyProfileBundleInput>;
};

function mergeIdentifiers(
  base: PartyIdentifierInput[],
  patch: PartyIdentifierInput[],
): PartyIdentifierInput[] {
  const bySchemePatch = new Map(patch.map((item) => [item.scheme, item]));
  const merged: PartyIdentifierInput[] = [];

  for (const existing of base) {
    const replacement = bySchemePatch.get(existing.scheme);
    if (replacement) {
      merged.push({ ...existing, value: replacement.value });
      bySchemePatch.delete(existing.scheme);
    } else {
      merged.push(existing);
    }
  }

  for (const remaining of bySchemePatch.values()) {
    merged.push(remaining);
  }

  return merged;
}

export function applyPartyProfilePatch(
  base: PartyProfileBundleInput,
  patch: Partial<PartyProfileBundleInput>,
): PartyProfileBundleInput {
  const next = clonePartyProfileBundleInput(base);

  if (patch.profile) {
    next.profile = { ...next.profile, ...patch.profile };
  }

  if (patch.identifiers) {
    next.identifiers = mergeIdentifiers(next.identifiers, patch.identifiers);
  }

  if (patch.address) {
    next.address = patch.address;
  }

  if (patch.contacts) {
    next.contacts = patch.contacts as PartyContactInput[];
  }

  if (patch.representatives) {
    next.representatives = patch.representatives as PartyRepresentativeInput[];
  }

  if (patch.licenses) {
    next.licenses = patch.licenses as PartyLicenseInput[];
  }

  return next;
}
