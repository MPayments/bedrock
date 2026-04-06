import { ValidationError } from "@bedrock/shared/core/errors";

import type { RequisiteKind } from "./requisite-kind";

export type PaymentIdentifierOwnerKind =
  | "provider"
  | "provider_branch"
  | "requisite";

export interface PaymentIdentifierInput {
  id?: string;
  scheme: string;
  value: string;
  isPrimary: boolean;
}

type SchemeDefinition = {
  owners: PaymentIdentifierOwnerKind[];
  kinds?: RequisiteKind[];
  normalize: (value: string) => string;
};

const compactUpper = (value: string) =>
  value.trim().replace(/\s+/g, "").toUpperCase();
const trimOnly = (value: string) => value.trim();
const upperTrim = (value: string) => value.trim().toUpperCase();

const PAYMENT_IDENTIFIER_SCHEMES: Record<string, SchemeDefinition> = {
  swift: {
    owners: ["provider", "provider_branch"],
    normalize: compactUpper,
  },
  bic: {
    owners: ["provider", "provider_branch"],
    normalize: compactUpper,
  },
  routing_code: {
    owners: ["provider", "provider_branch"],
    normalize: compactUpper,
  },
  branch_code: {
    owners: ["provider_branch"],
    normalize: compactUpper,
  },
  iban: {
    owners: ["requisite"],
    kinds: ["bank"],
    normalize: compactUpper,
  },
  local_account_number: {
    owners: ["requisite"],
    kinds: ["bank"],
    normalize: compactUpper,
  },
  corr_account: {
    owners: ["requisite"],
    kinds: ["bank"],
    normalize: compactUpper,
  },
  aba: {
    owners: ["requisite"],
    kinds: ["bank"],
    normalize: compactUpper,
  },
  sort_code: {
    owners: ["requisite"],
    kinds: ["bank"],
    normalize: compactUpper,
  },
  ifsc: {
    owners: ["requisite"],
    kinds: ["bank"],
    normalize: compactUpper,
  },
  clabe: {
    owners: ["requisite"],
    kinds: ["bank"],
    normalize: compactUpper,
  },
  wallet_address: {
    owners: ["requisite"],
    kinds: ["blockchain"],
    normalize: trimOnly,
  },
  memo_tag: {
    owners: ["requisite"],
    kinds: ["blockchain"],
    normalize: trimOnly,
  },
  network: {
    owners: ["requisite"],
    kinds: ["blockchain"],
    normalize: upperTrim,
  },
  asset_code: {
    owners: ["requisite"],
    kinds: ["blockchain"],
    normalize: upperTrim,
  },
  account_ref: {
    owners: ["requisite"],
    kinds: ["exchange", "custodian"],
    normalize: trimOnly,
  },
  subaccount_ref: {
    owners: ["requisite"],
    kinds: ["exchange", "custodian"],
    normalize: trimOnly,
  },
  contact: {
    owners: ["requisite"],
    normalize: trimOnly,
  },
};

function normalizeScheme(scheme: string): string {
  return scheme.trim().toLowerCase();
}

function resolveSchemeDefinition(input: {
  owner: PaymentIdentifierOwnerKind;
  scheme: string;
  requisiteKind?: RequisiteKind;
}) {
  const normalizedScheme = normalizeScheme(input.scheme);
  const definition = PAYMENT_IDENTIFIER_SCHEMES[normalizedScheme];

  if (!normalizedScheme) {
    throw new ValidationError("Identifier scheme is required");
  }

  if (!definition) {
    throw new ValidationError(`Unsupported identifier scheme: ${normalizedScheme}`);
  }

  if (!definition.owners.includes(input.owner)) {
    throw new ValidationError(
      `Identifier scheme ${normalizedScheme} is not allowed for ${input.owner}`,
    );
  }

  if (
    input.owner === "requisite" &&
    definition.kinds &&
    input.requisiteKind &&
    !definition.kinds.includes(input.requisiteKind)
  ) {
    throw new ValidationError(
      `Identifier scheme ${normalizedScheme} is not allowed for ${input.requisiteKind} requisites`,
    );
  }

  return { normalizedScheme, definition };
}

export function normalizePaymentIdentifierScheme(scheme: string): string {
  const normalizedScheme = normalizeScheme(scheme);

  if (!normalizedScheme) {
    throw new ValidationError("Identifier scheme is required");
  }

  return normalizedScheme;
}

export function normalizePaymentIdentifierValue(input: {
  owner: PaymentIdentifierOwnerKind;
  scheme: string;
  value: string;
  requisiteKind?: RequisiteKind;
}): string {
  const { definition } = resolveSchemeDefinition(input);
  const normalizedValue = definition.normalize(input.value);

  if (!normalizedValue) {
    throw new ValidationError(
      `Identifier value is required for scheme ${normalizeScheme(input.scheme)}`,
    );
  }

  return normalizedValue;
}

export function validatePaymentIdentifiers(input: {
  owner: PaymentIdentifierOwnerKind;
  identifiers: PaymentIdentifierInput[];
  requisiteKind?: RequisiteKind;
}) {
  const issues: string[] = [];
  const primaryByScheme = new Map<string, number>();
  const presentSchemes = new Set<string>();

  for (const item of input.identifiers) {
    try {
      const scheme = normalizePaymentIdentifierScheme(item.scheme);
      presentSchemes.add(scheme);
      normalizePaymentIdentifierValue({
        owner: input.owner,
        scheme,
        value: item.value,
        requisiteKind: input.requisiteKind,
      });

      if (item.isPrimary) {
        primaryByScheme.set(scheme, (primaryByScheme.get(scheme) ?? 0) + 1);
      }
    } catch (error) {
      issues.push(
        error instanceof Error ? error.message : "Invalid payment identifier",
      );
    }
  }

  for (const [scheme, count] of primaryByScheme.entries()) {
    if (count > 1) {
      issues.push(`Only one primary identifier is allowed for scheme ${scheme}`);
    }
  }

  if (input.owner === "requisite") {
    if (
      input.requisiteKind === "bank" &&
      !presentSchemes.has("iban") &&
      !presentSchemes.has("local_account_number")
    ) {
      issues.push(
        "Bank requisites must include iban or local_account_number identifier",
      );
    }

    if (
      input.requisiteKind === "blockchain" &&
      !presentSchemes.has("wallet_address")
    ) {
      issues.push("Blockchain requisites must include wallet_address identifier");
    }

    if (
      (input.requisiteKind === "exchange" ||
        input.requisiteKind === "custodian") &&
      !presentSchemes.has("account_ref") &&
      !presentSchemes.has("subaccount_ref")
    ) {
      issues.push(
        `${input.requisiteKind} requisites must include account_ref or subaccount_ref identifier`,
      );
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(issues.join("; "));
  }
}
