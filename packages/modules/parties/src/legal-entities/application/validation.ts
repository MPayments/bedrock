import { ValidationError } from "@bedrock/shared/core/errors";

import { assertUniqueLegalIdentifierSchemes } from "../domain/legal-identifier-schemes";
import type {
  PartyAddressInput,
  PartyContactInput,
  PartyLegalEntityBundleInput,
  PartyLegalIdentifierInput,
  PartyRepresentativeInput,
} from "./contracts";

function assertSinglePrimary<T extends { isPrimary: boolean }>(
  items: readonly T[],
  discriminator: (item: T) => string,
  field: string,
) {
  const primaryCounts = new Map<string, number>();

  for (const item of items) {
    if (!item.isPrimary) {
      continue;
    }

    const key = discriminator(item);
    primaryCounts.set(key, (primaryCounts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of primaryCounts) {
    if (count > 1) {
      throw new ValidationError(`Only one primary ${field} is allowed for ${key}`);
    }
  }
}

export function validateIdentifierInputs(
  items: readonly PartyLegalIdentifierInput[],
) {
  assertUniqueLegalIdentifierSchemes(items);
}

export function validateAddressInputs(items: readonly PartyAddressInput[]) {
  assertSinglePrimary(items, () => "address", "address");
}

export function validateContactInputs(items: readonly PartyContactInput[]) {
  assertSinglePrimary(items, (item) => item.type, "contact");
}

export function validateRepresentativeInputs(
  items: readonly PartyRepresentativeInput[],
) {
  assertSinglePrimary(items, (item) => item.role, "representative");
}

export function validateLegalEntityBundleInput(
  bundle: PartyLegalEntityBundleInput,
) {
  validateIdentifierInputs(bundle.identifiers);
  validateAddressInputs(bundle.addresses);
  validateContactInputs(bundle.contacts);
  validateRepresentativeInputs(bundle.representatives);
}
