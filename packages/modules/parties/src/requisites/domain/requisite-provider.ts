import { applyPatch } from "@bedrock/shared/core";
import {
  invariant,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core/domain";

import { normalizeCountryCode } from "./country-code";
import { isBankLikeRequisiteKind, type RequisiteKind } from "./requisite-kind";

export interface RequisiteProviderSnapshot {
  id: string;
  kind: RequisiteKind;
  name: string;
  description: string | null;
  country: string | null;
  address: string | null;
  contact: string | null;
  bic: string | null;
  swift: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisiteProviderDetails {
  kind: RequisiteKind;
  name: string;
  description: string | null;
  country: string | null;
  address: string | null;
  contact: string | null;
  bic: string | null;
  swift: string | null;
}

export interface UpdateRequisiteProviderPatch
  extends Partial<RequisiteProviderDetails> {
  now: Date;
}

export function validateRequisiteProviderDetails(
  input: RequisiteProviderDetails,
) {
  const kind = input.kind;
  const country = normalizeCountryCode(input.country);
  const bic = normalizeOptionalText(input.bic);
  const swift = normalizeOptionalText(input.swift);

  normalizeRequiredText(input.name, "requisite_provider.name.required", "name");

  if (isBankLikeRequisiteKind(kind)) {
    invariant(
      country !== null,
      `country is required for ${kind} providers`,
      {
        code: "requisite_provider.country.required",
        meta: { field: "country", kind },
      },
    );
  }

  if (kind === "bank") {
    if (country === "RU") {
      invariant(
        bic !== null,
        "bic is required for Russian banks",
        {
          code: "requisite_provider.bic.required",
          meta: { field: "bic", kind, country },
        },
      );
    } else if (country !== null) {
      invariant(
        swift !== null,
        "swift is required for non-Russian banks",
        {
          code: "requisite_provider.swift.required",
          meta: { field: "swift", kind, country },
        },
      );
    }
  } else {
    invariant(
      bic === null,
      "bic is only allowed for bank providers",
      {
        code: "requisite_provider.bic.not_allowed",
        meta: { field: "bic", kind },
      },
    );
    invariant(
      !(kind === "blockchain" && swift !== null),
      "swift is not applicable for blockchain providers",
      {
        code: "requisite_provider.swift.not_allowed",
        meta: { field: "swift", kind },
      },
    );
  }
}

export function normalizeRequisiteProviderDetails(
  input: RequisiteProviderDetails,
): Omit<
  RequisiteProviderSnapshot,
  "archivedAt" | "createdAt" | "id" | "updatedAt"
> {
  validateRequisiteProviderDetails(input);

  return {
    kind: input.kind,
    name: normalizeRequiredText(
      input.name,
      "requisite_provider.name.required",
      "name",
    ),
    description: normalizeOptionalText(input.description),
    country: normalizeCountryCode(input.country),
    address: normalizeOptionalText(input.address),
    contact: normalizeOptionalText(input.contact),
    bic: normalizeOptionalText(input.bic),
    swift: normalizeOptionalText(input.swift),
  };
}

export function createRequisiteProviderSnapshot(input: {
  id: string;
  now: Date;
} & RequisiteProviderDetails): RequisiteProviderSnapshot {
  return {
    id: input.id,
    ...normalizeRequisiteProviderDetails(input),
    archivedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function updateRequisiteProviderSnapshot(
  current: RequisiteProviderSnapshot,
  input: UpdateRequisiteProviderPatch,
): RequisiteProviderSnapshot {
  const { now, ...patch } = input;
  const next = applyPatch<RequisiteProviderSnapshot>(
    current,
    patch as Partial<RequisiteProviderSnapshot>,
  );

  return {
    ...next,
    ...normalizeRequisiteProviderDetails(next),
    archivedAt: current.archivedAt,
    createdAt: current.createdAt,
    updatedAt: now,
  };
}

export function archiveRequisiteProviderSnapshot(
  current: RequisiteProviderSnapshot,
  now: Date,
): RequisiteProviderSnapshot {
  return {
    ...current,
    archivedAt: current.archivedAt ?? now,
    updatedAt: now,
  };
}
