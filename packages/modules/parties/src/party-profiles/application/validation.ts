import { ValidationError } from "@bedrock/shared/core/errors";

import { assertUniqueLegalIdentifierSchemes } from "../domain/legal-identifier-schemes";
import type {
  PartyContactInput,
  PartyProfileBundleInput,
  PartyIdentifierInput,
  PartyRepresentativeInput,
} from "./contracts";

type PartyProfileKind = "individual" | "legal_entity";

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
  items: readonly PartyIdentifierInput[],
) {
  assertUniqueLegalIdentifierSchemes(items);
}

export function validateContactInputs(items: readonly PartyContactInput[]) {
  assertSinglePrimary(items, (item) => item.type, "contact");
}

export function validateRepresentativeInputs(
  items: readonly PartyRepresentativeInput[],
) {
  assertSinglePrimary(items, (item) => item.role, "representative");
}

export function validatePartyProfileBundleInput(
  bundle: PartyProfileBundleInput,
  kind: PartyProfileKind = "legal_entity",
) {
  validateIdentifierInputs(bundle.identifiers);
  validateContactInputs(bundle.contacts);

  if (kind === "individual") {
    const hasLegalOnlyProfileFields = Boolean(
      bundle.profile.legalFormCode ||
        bundle.profile.legalFormLabel ||
        bundle.profile.legalFormLabelI18n ||
        bundle.profile.businessActivityCode ||
        bundle.profile.businessActivityText,
    );

    if (hasLegalOnlyProfileFields) {
      throw new ValidationError(
        "Individuals cannot have legal-form or business-activity profile fields",
      );
    }

    if (bundle.representatives.length > 0) {
      throw new ValidationError(
        "Individuals cannot have representatives in party profile data",
      );
    }

    if (bundle.licenses.length > 0) {
      throw new ValidationError(
        "Individuals cannot have licenses in party profile data",
      );
    }

    return;
  }

  validateRepresentativeInputs(bundle.representatives);
}
