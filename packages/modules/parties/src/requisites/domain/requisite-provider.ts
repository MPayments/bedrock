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
  legalName: string;
  displayName: string;
  description: string | null;
  country: string | null;
  website: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisiteProviderDetails {
  kind: RequisiteKind;
  legalName: string;
  displayName: string;
  description: string | null;
  country: string | null;
  website: string | null;
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

  normalizeRequiredText(
    input.legalName,
    "requisite_provider.legal_name.required",
    "legalName",
  );
  normalizeRequiredText(
    input.displayName,
    "requisite_provider.display_name.required",
    "displayName",
  );

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
    legalName: normalizeRequiredText(
      input.legalName,
      "requisite_provider.legal_name.required",
      "legalName",
    ),
    displayName: normalizeRequiredText(
      input.displayName,
      "requisite_provider.display_name.required",
      "displayName",
    ),
    description: normalizeOptionalText(input.description),
    country: normalizeCountryCode(input.country),
    website: normalizeOptionalText(input.website),
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
